import { Injectable } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { OpenaiService } from '../openai/openai.service';
import { WeaviateService } from '../vector/weaviate.service';
import { FileExtractionService } from '../utils/file-extraction.service';
import * as XLSX from 'xlsx';
import { Readable } from 'stream';

export interface StructuredDataExtraction {
  type: 'table' | 'chart' | 'list' | 'hierarchical' | 'temporal' | 'mixed';
  confidence: number;
  data: any;
  metadata: {
    source: string;
    rowCount?: number;
    columnCount?: number;
    hasHeaders: boolean;
    dataTypes: Record<string, string>;
    dateColumns?: string[];
    numericColumns?: string[];
    categoricalColumns?: string[];
    textColumns?: string[];
  };
  suggestions: {
    blockTypes: string[];
    visualizations: string[];
    analysis: string[];
  };
}

export interface KnowledgeContext {
  relevantEntries: Array<{
    id: string;
    title: string;
    type: string;
    relevanceScore: number;
    extractedData?: StructuredDataExtraction;
    content?: string;
  }>;
  structuredData: StructuredDataExtraction[];
  insights: {
    dataPatterns: string[];
    businessContext: string[];
    recommendations: string[];
  };
}

@Injectable()
export class EnhancedKnowledgeIntegrationService {
  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly openaiService: OpenaiService,
    private readonly weaviateService: WeaviateService,
  ) {}

  /**
   * Enhanced knowledge base search with structured data extraction
   */
  async getEnhancedKnowledgeContext(
    prompt: string,
    workspaceId: string,
    maxEntries: number = 10
  ): Promise<KnowledgeContext> {
    // Step 1: Semantic search for relevant knowledge entries
    const queryEmbedding = await this.openaiService.generateEmbedding(prompt);
    const relevantChunks = await this.weaviateService.searchWorkspaceMemory(
      workspaceId,
      queryEmbedding,
      maxEntries * 2 // Get more chunks to filter
    );

    // Step 2: Group chunks by entry and calculate relevance scores
    const entryMap = new Map<string, any>();
    
    for (const chunk of relevantChunks) {
      try {
        const metadata = chunk.metadata ? JSON.parse(chunk.metadata) : {};
        const entryId = metadata.entryId;
        
        if (!entryId) continue;
        
        if (!entryMap.has(entryId)) {
          entryMap.set(entryId, {
            id: entryId,
            title: metadata.title || 'Unknown',
            type: 'document',
            relevanceScore: 0,
            chunks: [],
            content: ''
          });
        }
        
        const entry = entryMap.get(entryId);
        entry.chunks.push(chunk);
        entry.content += chunk.input + '\n';
        entry.relevanceScore += this.calculateChunkRelevance(chunk.input, prompt);
      } catch (error) {
        console.error('Error processing knowledge chunk:', error);
      }
    }

    // Step 3: Get full entry details and extract structured data
    const relevantEntries: KnowledgeContext['relevantEntries'] = [];
    const structuredData: StructuredDataExtraction[] = [];

    for (const [entryId, entry] of entryMap.entries()) {
      try {
        // Get full entry details
        const fullEntry = await this.knowledgeService.getEntryById(entryId);
        if (!fullEntry) continue;

        // Extract structured data if it's a file
        let extractedData: StructuredDataExtraction | undefined;
        if (fullEntry.fileUrl && fullEntry.mimeType) {
          extractedData = await this.extractStructuredDataFromFile(
            fullEntry.fileUrl,
            fullEntry.mimeType,
            fullEntry.fileName
          );
          
          if (extractedData) {
            structuredData.push(extractedData);
          }
        }

        relevantEntries.push({
          id: entryId,
          title: fullEntry.title,
          type: fullEntry.type,
          relevanceScore: entry.relevanceScore,
          extractedData,
          content: entry.content
        });
      } catch (error) {
        console.error(`Error processing entry ${entryId}:`, error);
      }
    }

    // Step 4: Sort by relevance and limit results
    relevantEntries.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const topEntries = relevantEntries.slice(0, maxEntries);

    // Step 5: Generate insights from the data
    const insights = await this.generateKnowledgeInsights(topEntries, structuredData, prompt);

    return {
      relevantEntries: topEntries,
      structuredData,
      insights
    };
  }

  /**
   * Extract structured data from uploaded files
   */
  async extractStructuredDataFromFile(
    fileUrl: string,
    mimeType: string,
    fileName: string
  ): Promise<StructuredDataExtraction | undefined> {
    try {
      const fileType = this.getFileTypeForExtraction(mimeType, fileName);
      
      if (fileType === 'csv') {
        return await this.extractStructuredDataFromCSV(fileUrl);
      } else if (fileType === 'xlsx' || fileType === 'xls') {
        return await this.extractStructuredDataFromExcel(fileUrl);
      } else if (fileType === 'pdf') {
        return await this.extractStructuredDataFromPDF(fileUrl);
      } else if (fileType === 'txt' || fileType === 'md') {
        return await this.extractStructuredDataFromText(fileUrl);
      }
      
      return undefined;
    } catch (error) {
      console.error('Error extracting structured data from file:', error);
      return undefined;
    }
  }

  /**
   * Extract structured data from CSV files
   */
  private async extractStructuredDataFromCSV(fileUrl: string): Promise<StructuredDataExtraction> {
    // For CSV, we'll use the existing file extraction to get text, then parse
    const csvText = await FileExtractionService.extractTextFromFile(fileUrl, 'csv');
    const lines = csvText.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('CSV file must have at least headers and one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const dataRows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row;
    });

    const dataTypes = this.inferDataTypes(dataRows, headers);
    const metadata = this.buildMetadata(dataRows, headers, dataTypes);

    return {
      type: 'table',
      confidence: 0.95,
      data: { headers, rows: dataRows },
      metadata,
      suggestions: this.generateSuggestions(metadata, dataRows)
    };
  }

  /**
   * Extract structured data from Excel files
   */
  private async extractStructuredDataFromExcel(fileUrl: string): Promise<StructuredDataExtraction> {
    // Download file from S3
    const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
    const s3 = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    const match = fileUrl.match(/https:\/\/([^\.]+)\.s3\.amazonaws\.com\/(.+)/);
    if (!match) throw new Error('Invalid S3 URL');
    
    const Bucket = match[1];
    const Key = match[2];
    const command = new GetObjectCommand({ Bucket, Key });
    const { Body } = await s3.send(command);
    
    if (!Body) throw new Error('S3 file Body is undefined');
    const buffer = Buffer.from(await Body.transformToByteArray());

    // Parse Excel file
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0]; // Use first sheet
    const sheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    if (jsonData.length < 2) {
      throw new Error('Excel file must have at least headers and one data row');
    }

    const headers = jsonData[0] as string[];
    const dataRows = jsonData.slice(1).map((row: any[]) => {
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });

    const dataTypes = this.inferDataTypes(dataRows, headers);
    const metadata = this.buildMetadata(dataRows, headers, dataTypes);

    return {
      type: 'table',
      confidence: 0.9,
      data: { headers, rows: dataRows },
      metadata,
      suggestions: this.generateSuggestions(metadata, dataRows)
    };
  }

  /**
   * Extract structured data from PDF files using LLM
   */
  private async extractStructuredDataFromPDF(fileUrl: string): Promise<StructuredDataExtraction> {
    const pdfText = await FileExtractionService.extractTextFromFile(fileUrl, 'pdf');
    
    // Use LLM to extract structured data from PDF text
    const prompt = `
Analyze the following PDF content and extract any structured data (tables, lists, charts, etc.).
If you find structured data, return it in JSON format. If not, return null.

PDF Content:
${pdfText.slice(0, 3000)} // Limit to first 3000 chars

Return format:
{
  "type": "table|chart|list|hierarchical|temporal|mixed|null",
  "confidence": 0.0-1.0,
  "data": {
    // Structured data in appropriate format
  },
  "metadata": {
    "source": "pdf",
    "rowCount": number,
    "columnCount": number,
    "hasHeaders": boolean,
    "dataTypes": {"column": "type"},
    "dateColumns": ["column1", "column2"],
    "numericColumns": ["column1", "column2"],
    "categoricalColumns": ["column1", "column2"],
    "textColumns": ["column1", "column2"]
  }
}
`;

    try {
      const response = await this.openaiService.chatCompletion({
        model: 'gpt-4-1106-preview',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 512
      });
      const result = JSON.parse(response);
      
      if (result && result.type !== 'null') {
        return {
          ...result,
          suggestions: this.generateSuggestions(result.metadata, result.data.rows || [])
        };
      }
    } catch (error) {
      console.error('Error extracting structured data from PDF:', error);
    }

    // Fallback: return as text
    return {
      type: 'mixed',
      confidence: 0.3,
      data: { content: pdfText },
      metadata: {
        source: 'pdf',
        hasHeaders: false,
        dataTypes: {},
        textColumns: ['content']
      },
      suggestions: {
        blockTypes: ['text'],
        visualizations: [],
        analysis: ['text-analysis', 'summarization']
      }
    };
  }

  /**
   * Extract structured data from text files
   */
  private async extractStructuredDataFromText(fileUrl: string): Promise<StructuredDataExtraction> {
    const text = await FileExtractionService.extractTextFromFile(fileUrl, 'txt');
    
    // Try to detect structured patterns in text
    const patterns = this.detectTextPatterns(text);
    
    if (patterns.type !== 'mixed') {
      return {
        ...patterns,
        suggestions: this.generateSuggestions(patterns.metadata, patterns.data.rows || [])
      };
    }

    return {
      type: 'mixed',
      confidence: 0.4,
      data: { content: text },
      metadata: {
        source: 'text',
        hasHeaders: false,
        dataTypes: {},
        textColumns: ['content']
      },
      suggestions: {
        blockTypes: ['text', 'note'],
        visualizations: [],
        analysis: ['text-analysis', 'summarization', 'keyword-extraction']
      }
    };
  }

  /**
   * Detect patterns in text content
   */
  private detectTextPatterns(text: string): StructuredDataExtraction {
    const lines = text.split('\n').filter(line => line.trim());
    
    // Check for table-like patterns
    const tablePattern = /^[^|]*\|[^|]*\|[^|]*$/;
    const tableLines = lines.filter(line => tablePattern.test(line));
    
    if (tableLines.length >= 2) {
      const headers = tableLines[0].split('|').map(h => h.trim());
      const dataRows = tableLines.slice(1).map(line => {
        const values = line.split('|').map(v => v.trim());
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        return row;
      });

      const dataTypes = this.inferDataTypes(dataRows, headers);
      const metadata = this.buildMetadata(dataRows, headers, dataTypes);

      return {
        type: 'table',
        confidence: 0.8,
        data: { headers, rows: dataRows },
        metadata,
        suggestions: this.generateSuggestions(metadata, dataRows)
      };
    }

    // Check for list patterns
    const listPattern = /^[\s]*[-*•]\s+/;
    const listItems = lines.filter(line => listPattern.test(line));
    
    if (listItems.length >= 3) {
      const items = listItems.map(line => line.replace(/^[\s]*[-*•]\s+/, ''));
      
      return {
        type: 'list',
        confidence: 0.7,
        data: { items },
        metadata: {
          source: 'text',
          hasHeaders: false,
          dataTypes: {},
          textColumns: ['items']
        },
        suggestions: {
          blockTypes: ['task-list', 'note'],
          visualizations: [],
          analysis: ['list-analysis', 'categorization']
        }
      };
    }

    // Default to mixed
    return {
      type: 'mixed',
      confidence: 0.3,
      data: { content: text },
      metadata: {
        source: 'text',
        hasHeaders: false,
        dataTypes: {},
        textColumns: ['content']
      },
      suggestions: {
        blockTypes: ['text'],
        visualizations: [],
        analysis: ['text-analysis', 'summarization']
      }
    };
  }

  /**
   * Infer data types from data rows
   */
  private inferDataTypes(rows: any[], headers: string[]): Record<string, string> {
    const dataTypes: Record<string, string> = {};
    
    headers.forEach(header => {
      const values = rows.map(row => row[header]).filter(v => v !== '' && v !== null && v !== undefined);
      
      if (values.length === 0) {
        dataTypes[header] = 'text';
        return;
      }

      // Check for dates
      const datePattern = /^\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4}$/;
      if (values.some(v => datePattern.test(String(v)))) {
        dataTypes[header] = 'date';
        return;
      }

      // Check for numbers
      const numericValues = values.filter(v => !isNaN(Number(v)) && v !== '');
      if (numericValues.length / values.length > 0.8) {
        dataTypes[header] = 'number';
        return;
      }

      // Check for categories (limited unique values)
      const uniqueValues = new Set(values);
      if (uniqueValues.size / values.length < 0.3 && uniqueValues.size < 20) {
        dataTypes[header] = 'category';
        return;
      }

      dataTypes[header] = 'text';
    });

    return dataTypes;
  }

  /**
   * Build metadata from data analysis
   */
  private buildMetadata(
    rows: any[],
    headers: string[],
    dataTypes: Record<string, string>
  ): StructuredDataExtraction['metadata'] {
    const dateColumns = headers.filter(h => dataTypes[h] === 'date');
    const numericColumns = headers.filter(h => dataTypes[h] === 'number');
    const categoricalColumns = headers.filter(h => dataTypes[h] === 'category');
    const textColumns = headers.filter(h => dataTypes[h] === 'text');

    return {
      source: 'file',
      rowCount: rows.length,
      columnCount: headers.length,
      hasHeaders: true,
      dataTypes,
      dateColumns,
      numericColumns,
      categoricalColumns,
      textColumns
    };
  }

  /**
   * Generate suggestions based on data analysis
   */
  private generateSuggestions(
    metadata: StructuredDataExtraction['metadata'],
    rows: any[]
  ): StructuredDataExtraction['suggestions'] {
    const suggestions = {
      blockTypes: [] as string[],
      visualizations: [] as string[],
      analysis: [] as string[]
    };

    // Block type suggestions
    if (metadata.rowCount && metadata.rowCount > 0) {
      suggestions.blockTypes.push('table');
      
      if (metadata.numericColumns && metadata.numericColumns.length > 0) {
        suggestions.blockTypes.push('chart');
        suggestions.visualizations.push('bar-chart', 'line-chart', 'pie-chart');
      }
      
      if (metadata.dateColumns && metadata.dateColumns.length > 0) {
        suggestions.blockTypes.push('timeline');
        suggestions.visualizations.push('line-chart', 'area-chart');
      }
      
      if (metadata.categoricalColumns && metadata.categoricalColumns.length > 0) {
        suggestions.visualizations.push('pie-chart', 'bar-chart');
      }
    }

    // Analysis suggestions
    if (metadata.numericColumns && metadata.numericColumns.length > 0) {
      suggestions.analysis.push('trend-analysis', 'statistical-analysis', 'comparison');
    }
    
    if (metadata.dateColumns && metadata.dateColumns.length > 0) {
      suggestions.analysis.push('temporal-analysis', 'seasonality-analysis');
    }
    
    if (metadata.categoricalColumns && metadata.categoricalColumns.length > 0) {
      suggestions.analysis.push('categorization', 'distribution-analysis');
    }

    return suggestions;
  }

  /**
   * Generate insights from knowledge entries and structured data
   */
  private async generateKnowledgeInsights(
    entries: any[],
    structuredData: StructuredDataExtraction[],
    prompt: string
  ): Promise<KnowledgeContext['insights']> {
    const insights = {
      dataPatterns: [] as string[],
      businessContext: [] as string[],
      recommendations: [] as string[]
    };

    // Analyze data patterns
    for (const data of structuredData) {
      if (data.metadata.numericColumns && data.metadata.numericColumns.length > 0) {
        insights.dataPatterns.push('Numerical data available for analysis');
      }
      
      if (data.metadata.dateColumns && data.metadata.dateColumns.length > 0) {
        insights.dataPatterns.push('Temporal data available for trend analysis');
      }
      
      if (data.metadata.categoricalColumns && data.metadata.categoricalColumns.length > 0) {
        insights.dataPatterns.push('Categorical data available for grouping');
      }
    }

    // Generate business context from entry titles and content
    const titles = entries.map(e => e.title).join(', ');
    if (titles) {
      insights.businessContext.push(`Available knowledge: ${titles}`);
    }

    // Generate recommendations based on data and prompt
    if (structuredData.length > 0) {
      insights.recommendations.push('Use structured data from knowledge base for enhanced analysis');
    }
    
    if (entries.length > 0) {
      insights.recommendations.push('Leverage existing knowledge for context-aware responses');
    }

    return insights;
  }

  /**
   * Calculate relevance score for a chunk
   */
  private calculateChunkRelevance(chunkText: string, prompt: string): number {
    const promptWords = prompt.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const chunkWords = chunkText.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    
    let matches = 0;
    for (const word of promptWords) {
      if (chunkWords.includes(word)) {
        matches++;
      }
    }
    
    return matches / promptWords.length;
  }

  /**
   * Get file type for extraction
   */
  private getFileTypeForExtraction(mimeType: string, fileName: string): string {
    if (mimeType === 'text/csv' || fileName.toLowerCase().endsWith('.csv')) return 'csv';
    if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
        fileName.toLowerCase().endsWith('.xlsx')) return 'xlsx';
    if (mimeType === 'application/vnd.ms-excel' || fileName.toLowerCase().endsWith('.xls')) return 'xls';
    if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) return 'pdf';
    if (mimeType === 'text/plain' || fileName.toLowerCase().endsWith('.txt')) return 'txt';
    if (mimeType === 'text/markdown' || fileName.toLowerCase().endsWith('.md')) return 'md';
    return 'unknown';
  }
} 
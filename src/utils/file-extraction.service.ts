import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import * as mammoth from "mammoth";
import * as XLSX from "xlsx";
import * as textract from "textract";
import * as Tesseract from "tesseract.js";
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import * as PNG from 'pngjs';

export class FileExtractionService {
  static async extractTextFromFile(filePathOrUrl: string, type: string): Promise<string> {
    let dataBuffer: Buffer;
    let localPath = filePathOrUrl;
    // Download from S3 if needed
    if (filePathOrUrl.startsWith('http')) {
      const match = filePathOrUrl.match(/https:\/\/([^\.]+)\.s3\.amazonaws\.com\/(.+)/);
      if (!match) throw new Error('Invalid S3 URL');
      const Bucket = match[1];
      const Key = match[2];
      const s3 = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });
      const command = new GetObjectCommand({ Bucket, Key });
      const { Body } = await s3.send(command);
      if (!Body) throw new Error('S3 file Body is undefined');
      dataBuffer = Buffer.from(await Body.transformToByteArray());
      // Save to temp file for loaders that require a path
      const tmp = require('tmp');
      const tmpFile = tmp.fileSync();
      fs.writeFileSync(tmpFile.name, dataBuffer);
      localPath = tmpFile.name;
    } else {
      dataBuffer = fs.readFileSync(filePathOrUrl);
    }

    // PDF
    if (type === 'pdf' || type === 'pdfa') {
      let text = '';
      try {
        const loader = new PDFLoader(localPath);
        const docs = await loader.load();
        text = docs.map(d => d.pageContent).join('\n\n');
      } catch (e) {
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(dataBuffer);
        text = data.text;
      }
      if (!text.trim() || text.trim().toLowerCase().includes('scanned by tapscanner')) {
        try {
          const pdfData = dataBuffer instanceof Uint8Array ? dataBuffer : new Uint8Array(dataBuffer);
          const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
          let ocrText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const ops = await page.getOperatorList();
            for (let j = 0; j < ops.fnArray.length; j++) {
              if (ops.fnArray[j] === pdfjsLib.OPS.paintImageXObject) {
                const imgName = ops.argsArray[j][0];
                const img = await page.objs.get(imgName);
                if (img && img.data) {
                  const { width, height, data } = img;
                  const png = PNG.PNG;
                  const pngImage = new png({ width, height });
                  pngImage.data = Buffer.from(data);
                  const buffer = PNG.sync.write(pngImage);
                  const { data: { text: ocrResult } } = await Tesseract.recognize(buffer, 'eng');
                  ocrText += ocrResult + '\n';
                }
              }
            }
          }
          if (ocrText.trim()) {
            text = ocrText;
          }
        } catch (ocrErr) {
          console.error('[Extract][PDF][OCR] Error extracting OCR from scanned PDF:', ocrErr);
        }
      }
      return text;
    }
    // DOCX
    if (type === 'docx' || type === 'doc') {
      try {
        const loader = new DocxLoader(localPath);
        const docs = await loader.load();
        return docs.map(d => d.pageContent).join('\n\n');
      } catch (e) {
        const { value } = await mammoth.extractRawText({ buffer: dataBuffer });
        return value;
      }
    }
    // XLS/XLSX
    if (type === 'xls' || type === 'xlsx') {
      try {
        const workbook = XLSX.read(dataBuffer, { type: 'buffer' });
        let text = '';
        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          text += `Sheet: ${sheetName}\n${csv}\n`;
        });
        return text;
      } catch (e) {
        return await new Promise((resolve, reject) => {
          textract.fromBufferWithMime('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', dataBuffer, (err, text) => {
            if (err) reject(err);
            else resolve(text);
          });
        });
      }
    }
    // PPT/PPTX
    if (type === 'ppt' || type === 'pptx') {
      try {
        return await new Promise((resolve, reject) => {
          textract.fromBufferWithMime('application/vnd.openxmlformats-officedocument.presentationml.presentation', dataBuffer, (err, text) => {
            if (err) reject(err);
            else resolve(text);
          });
        });
      } catch (e) {
        return '';
      }
    }
    // Images (jpg, jpeg, png, gif, bmp, tiff)
    if (["jpg", "jpeg", "png", "gif", "bmp", "tiff"].includes(type)) {
      try {
        const { data: { text } } = await Tesseract.recognize(dataBuffer, 'eng');
        return text;
      } catch (e) {
        return '';
      }
    }
    // ODT
    if (type === 'odt') {
      try {
        return await new Promise((resolve, reject) => {
          textract.fromBufferWithMime('application/vnd.oasis.opendocument.text', dataBuffer, (err, text) => {
            if (err) reject(err);
            else resolve(text);
          });
        });
      } catch (e) {
        console.error('[Extract][ODT] Error extracting ODT:', e);
        return '';
      }
    }
    // RTF
    if (type === 'rtf') {
      try {
        return await new Promise((resolve, reject) => {
          textract.fromBufferWithMime('application/rtf', dataBuffer, (err, text) => {
            if (err) reject(err);
            else resolve(text);
          });
        });
      } catch (e) {
        console.error('[Extract][RTF] Error extracting RTF:', e);
        return '';
      }
    }
    // TXT, MD, CSV
    if (["md", "txt", "csv"].includes(type)) {
      return dataBuffer.toString('utf-8');
    }
    throw new Error('Unsupported file type');
  }
} 
import { SmartDetectionService } from './smart-detection.service';

// This is a demonstration file showing how the smart detection algorithm works
// In a real implementation, this would be a proper Jest test file

export class SmartDetectionDemo {
  private smartDetection = new SmartDetectionService();

  async runDemo() {
    console.log('🧠 Smart Detection Algorithm Demo\n');

    // Demo 1: Tabular Data Detection
    await this.demoTabularData();

    // Demo 2: Temporal Data Detection
    await this.demoTemporalData();

    // Demo 3: Intent Analysis
    await this.demoIntentAnalysis();

    // Demo 4: Block Recommendations
    await this.demoBlockRecommendations();

    // Demo 5: Data Transformation
    await this.demoDataTransformation();

    // Demo 6: Complex Scenarios
    await this.demoComplexScenarios();
  }

  private async demoTabularData() {
    console.log('📊 Demo 1: Tabular Data Detection');
    
    const tabularData = [
      { name: 'John Doe', email: 'john@example.com', age: 30, department: 'Engineering' },
      { name: 'Jane Smith', email: 'jane@example.com', age: 25, department: 'Marketing' },
      { name: 'Bob Johnson', email: 'bob@example.com', age: 35, department: 'Sales' }
    ];

    const pattern = this.smartDetection.analyzeDataStructure(tabularData);
    console.log('Data Pattern:', pattern);
    console.log('Expected: tabular type with high confidence\n');
  }

  private async demoTemporalData() {
    console.log('📅 Demo 2: Temporal Data Detection');
    
    const temporalData = {
      events: [
        { title: 'Project Kickoff', date: '2024-01-15', description: 'Start of new project' },
        { title: 'Sprint Planning', date: '2024-01-22', description: 'Plan next sprint' },
        { title: 'Demo Day', date: '2024-02-01', description: 'Present results' }
      ]
    };

    const pattern = this.smartDetection.analyzeDataStructure(temporalData);
    console.log('Data Pattern:', pattern);
    console.log('Expected: temporal type with dates\n');
  }

  private async demoIntentAnalysis() {
    console.log('🎯 Demo 3: Intent Analysis');
    
    const prompts = [
      'Show me a chart of sales data for Q1',
      'Create a project timeline for the new feature',
      'Track our team tasks in a kanban board',
      'Analyze customer feedback data',
      'Plan the marketing campaign schedule'
    ];

    prompts.forEach(prompt => {
      const intent = this.smartDetection.analyzeIntent(prompt);
      console.log(`Prompt: "${prompt}"`);
      console.log(`Intent: ${intent.primaryIntent} (${intent.interactionType})`);
      console.log(`Requirements: ${intent.dataRequirements.join(', ')}`);
      console.log(`Visualization: ${intent.visualizationNeeds.join(', ')}\n`);
    });
  }

  private async demoBlockRecommendations() {
    console.log('🔍 Demo 4: Block Recommendations');
    
    const scenarios = [
      {
        prompt: 'Show me sales data for the last quarter',
        data: [
          { month: 'Jan', sales: 10000, profit: 2000 },
          { month: 'Feb', sales: 12000, profit: 2400 },
          { month: 'Mar', sales: 15000, profit: 3000 }
        ]
      },
      {
        prompt: 'Create a project timeline',
        data: {
          events: [
            { title: 'Planning', date: '2024-01-01' },
            { title: 'Development', date: '2024-01-15' },
            { title: 'Testing', date: '2024-02-01' },
            { title: 'Launch', date: '2024-02-15' }
          ]
        }
      }
    ];

    scenarios.forEach((scenario, index) => {
      console.log(`Scenario ${index + 1}: ${scenario.prompt}`);
      
      const intent = this.smartDetection.analyzeIntent(scenario.prompt);
      const pattern = this.smartDetection.analyzeDataStructure(scenario.data);
      const recommendations = this.smartDetection.generateBlockRecommendations(
        intent,
        pattern,
        scenario.data
      );

      console.log('Recommendations:');
      recommendations.forEach(rec => {
        console.log(`  - ${rec.type} (${rec.confidence}): ${rec.reasoning}`);
      });
      console.log('');
    });
  }

  private async demoDataTransformation() {
    console.log('🔄 Demo 5: Data Transformation');
    
    const rawData = [
      { name: 'Task 1', status: 'To Do', assignee: 'John' },
      { name: 'Task 2', status: 'In Progress', assignee: 'Jane' },
      { name: 'Task 3', status: 'Done', assignee: 'Bob' }
    ];

    const transformations = ['table', 'kanban', 'list', 'chart'];

    transformations.forEach(blockType => {
      const transformed = this.smartDetection.transformDataForBlock(rawData, blockType);
      console.log(`${blockType.toUpperCase()} transformation:`);
      console.log(JSON.stringify(transformed, null, 2));
      console.log('');
    });
  }

  private async demoComplexScenarios() {
    console.log('🎭 Demo 6: Complex Scenarios');
    
    const complexPrompts = [
      {
        prompt: 'Create a dashboard for our CRM with customer data, sales pipeline, and upcoming meetings',
        description: 'Multi-block dashboard with different data types'
      },
      {
        prompt: 'Analyze our website traffic data and show trends over time with key metrics',
        description: 'Analytics-focused with time series data'
      },
      {
        prompt: 'Plan our product launch with tasks, timeline, and team assignments',
        description: 'Project management with multiple components'
      }
    ];

    complexPrompts.forEach((scenario, index) => {
      console.log(`Complex Scenario ${index + 1}: ${scenario.description}`);
      console.log(`Prompt: "${scenario.prompt}"`);
      
      const intent = this.smartDetection.analyzeIntent(scenario.prompt);
      console.log(`Primary Intent: ${intent.primaryIntent}`);
      console.log(`Secondary Intents: ${intent.secondaryIntents.join(', ')}`);
      console.log(`Data Requirements: ${intent.dataRequirements.join(', ')}`);
      console.log(`Visualization Needs: ${intent.visualizationNeeds.join(', ')}`);
      
      // Simulate extracted data
      const extractedData = this.smartDetection.extractStructuredData(scenario.prompt);
      if (extractedData) {
        const pattern = this.smartDetection.analyzeDataStructure(extractedData);
        const recommendations = this.smartDetection.generateBlockRecommendations(
          intent,
          pattern,
          extractedData
        );
        
        console.log('Block Recommendations:');
        recommendations.slice(0, 3).forEach(rec => {
          console.log(`  - ${rec.type} (${rec.confidence}): ${rec.reasoning}`);
        });
      }
      console.log('');
    });
  }

  // Example usage scenarios
  static getExampleScenarios() {
    return [
      {
        name: 'Sales Dashboard',
        prompt: 'Create a sales dashboard with monthly revenue data, top customers, and sales pipeline',
        expectedBlocks: ['chart', 'table', 'kanban'],
        dataType: 'tabular'
      },
      {
        name: 'Project Timeline',
        prompt: 'Show me a timeline of our product development milestones',
        expectedBlocks: ['timeline', 'calendar'],
        dataType: 'temporal'
      },
      {
        name: 'Task Management',
        prompt: 'Track our team tasks with status updates and assignments',
        expectedBlocks: ['kanban', 'list', 'table'],
        dataType: 'hierarchical'
      },
      {
        name: 'Analytics Report',
        prompt: 'Analyze our website performance with traffic charts and conversion data',
        expectedBlocks: ['chart', 'table', 'text'],
        dataType: 'numerical'
      }
    ];
  }

  // Performance testing
  async performanceTest() {
    console.log('⚡ Performance Test');
    
    const testData = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      name: `Item ${i}`,
      value: Math.random() * 100,
      category: ['A', 'B', 'C'][Math.floor(Math.random() * 3)],
      date: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
    }));

    const startTime = Date.now();
    const pattern = this.smartDetection.analyzeDataStructure(testData);
    const endTime = Date.now();

    console.log(`Analyzed ${testData.length} items in ${endTime - startTime}ms`);
    console.log('Pattern:', pattern);
  }
}

// Example usage
if (require.main === module) {
  const demo = new SmartDetectionDemo();
  demo.runDemo().then(() => {
    console.log('✅ Smart Detection Demo Complete');
  });
} 
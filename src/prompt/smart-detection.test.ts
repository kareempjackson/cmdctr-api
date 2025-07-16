import { SmartDetectionService } from './smart-detection.service';

// This is a demonstration file showing how the smart detection algorithm works
// In a real implementation, this would be a proper Jest test file

export class SmartDetectionDemo {
  private smartDetection = new SmartDetectionService();

  async runComprehensiveDemo() {
    console.log('🚀 Enhanced Smart Canvas Algorithm Demo\n');
    
    await this.demoIntentAnalysis();
    await this.demoDataStructureAnalysis();
    await this.demoBlockRecommendations();
    await this.demoSmartCombinations();
    await this.demoContextAwareRecommendations();
    await this.demoComplexScenarios();
  }

  private async demoIntentAnalysis() {
    console.log('🎯 Enhanced Intent Analysis');
    
    const prompts = [
      'Show me a chart of sales data for Q1',
      'Create a project timeline for the new feature',
      'Track our team tasks in a kanban board',
      'Analyze customer feedback data',
      'Plan the marketing campaign schedule',
      'Collaborate with the team on the design review',
      'Manage the development workflow',
      'Create a comprehensive dashboard for our analytics'
    ];

    prompts.forEach(prompt => {
      const intent = this.smartDetection.analyzeIntent(prompt);
      console.log(`\nPrompt: "${prompt}"`);
      console.log(`Primary Intent: ${intent.primaryIntent}`);
      console.log(`Secondary Intents: ${intent.secondaryIntents.join(', ')}`);
      console.log(`Domain: ${intent.domain || 'None'}`);
      console.log(`Use Case: ${intent.useCase || 'None'}`);
      console.log(`Complexity: ${intent.complexity}`);
      console.log(`Urgency: ${intent.urgency}`);
      console.log(`Data Requirements: ${intent.dataRequirements.join(', ')}`);
      console.log(`Visualization Needs: ${intent.visualizationNeeds.join(', ')}`);
    });
  }

  private async demoDataStructureAnalysis() {
    console.log('\n📊 Enhanced Data Structure Analysis');
    
    const dataExamples = [
      // Tabular data
      [
        { name: 'John', age: 30, department: 'Engineering', salary: 75000 },
        { name: 'Jane', age: 28, department: 'Marketing', salary: 65000 },
        { name: 'Bob', age: 35, department: 'Sales', salary: 80000 }
      ],
      // Temporal data
      {
        events: [
          { title: 'Project Kickoff', date: '2024-01-15', description: 'Start of new project' },
          { title: 'Phase 1 Complete', date: '2024-02-15', description: 'First milestone reached' },
          { title: 'Final Review', date: '2024-03-15', description: 'Project completion' }
        ]
      },
      // Sequential data
      {
        tasks: [
          { id: 1, text: 'Research requirements', completed: false, priority: 'high' },
          { id: 2, text: 'Create wireframes', completed: false, priority: 'medium' },
          { id: 3, text: 'Develop prototype', completed: false, priority: 'high' }
        ]
      }
    ];

    dataExamples.forEach((data, index) => {
      const pattern = this.smartDetection.analyzeDataStructure(data);
      console.log(`\nData Example ${index + 1}:`);
      console.log(`Type: ${pattern.type}`);
      console.log(`Confidence: ${pattern.confidence}`);
      console.log(`Complexity: ${pattern.metadata.complexity || 'Not assessed'}`);
      console.log(`Data Quality: ${pattern.metadata.dataQuality || 'Not assessed'}`);
      console.log(`Has Dates: ${pattern.metadata.hasDates}`);
      console.log(`Has Numbers: ${pattern.metadata.hasNumbers}`);
    });
  }

  private async demoBlockRecommendations() {
    console.log('\n🧩 Enhanced Block Recommendations');
    
    const scenarios = [
      {
        prompt: 'Analyze our quarterly sales performance',
        intent: this.smartDetection.analyzeIntent('Analyze our quarterly sales performance'),
        data: [
          { quarter: 'Q1', sales: 100000, growth: 15 },
          { quarter: 'Q2', sales: 120000, growth: 20 },
          { quarter: 'Q3', sales: 110000, growth: -8 },
          { quarter: 'Q4', sales: 140000, growth: 27 }
        ]
      },
      {
        prompt: 'Track our development project progress',
        intent: this.smartDetection.analyzeIntent('Track our development project progress'),
        data: {
          tasks: [
            { id: 1, title: 'Setup environment', status: 'completed', assignee: 'John' },
            { id: 2, title: 'Design UI', status: 'in-progress', assignee: 'Jane' },
            { id: 3, title: 'Implement backend', status: 'not-started', assignee: 'Bob' }
          ]
        }
      },
      {
        prompt: 'Plan our marketing campaign',
        intent: this.smartDetection.analyzeIntent('Plan our marketing campaign'),
        data: {
          events: [
            { title: 'Campaign Launch', date: '2024-01-15', description: 'Social media campaign starts' },
            { title: 'Email Series', date: '2024-01-20', description: 'Email marketing begins' },
            { title: 'Analytics Review', date: '2024-02-15', description: 'Review campaign performance' }
          ]
        }
      }
    ];

    scenarios.forEach((scenario, index) => {
      console.log(`\nScenario ${index + 1}: "${scenario.prompt}"`);
      
      const dataPattern = this.smartDetection.analyzeDataStructure(scenario.data);
      const recommendations = this.smartDetection.generateBlockRecommendations(
        scenario.intent,
        dataPattern,
        scenario.data
      );
      
      recommendations.forEach((rec, recIndex) => {
        console.log(`  Recommendation ${recIndex + 1}:`);
        console.log(`    Type: ${rec.type}`);
        console.log(`    Confidence: ${rec.confidence}`);
        console.log(`    Priority: ${rec.priority || 'Not set'}`);
        console.log(`    Reasoning: ${rec.reasoning}`);
        console.log(`    Estimated Complexity: ${rec.estimatedComplexity || 'Not calculated'}`);
        console.log(`    User Experience: ${rec.userExperience || 'Not determined'}`);
      });
    });
  }

  private async demoSmartCombinations() {
    console.log('\n🎨 Smart Block Combinations');
    
    const useCases = [
      'project-management',
      'data-analysis',
      'planning',
      'tracking',
      'reporting',
      'collaboration',
      'learning'
    ];

    useCases.forEach(useCase => {
      const intent = {
        primaryIntent: 'track',
        secondaryIntents: [],
        dataRequirements: ['data'],
        visualizationNeeds: ['table'],
        interactionType: 'track' as any,
        complexity: 'moderate' as 'simple' | 'moderate' | 'complex',
        useCase,
        domain: 'business'
      };
      
      const dataPattern = {
        type: 'tabular' as any,
        confidence: 0.8,
        structure: [],
        metadata: { complexity: 'moderate' as 'simple' | 'moderate' | 'complex', dataQuality: 'high' as 'high' | 'medium' | 'low' }
      };
      
      const combinations = this.smartDetection['generateSmartBlockCombinations'](intent, dataPattern);
      console.log(`\n${useCase.toUpperCase()}:`);
      combinations.forEach((combo, index) => {
        console.log(`  Combination ${index + 1}: ${combo.join(' + ')}`);
      });
    });
  }

  private async demoContextAwareRecommendations() {
    console.log('\n🏢 Context-Aware Recommendations');
    
    const contexts = [
      {
        name: 'Individual User',
        context: {
          workspaceId: 'workspace-1',
          userId: 'user-1',
          collaborationLevel: 'individual' as any,
          workspaceType: 'analytics'
        }
      },
      {
        name: 'Team Collaboration',
        context: {
          workspaceId: 'workspace-2',
          userId: 'user-2',
          collaborationLevel: 'team' as any,
          workspaceType: 'project'
        }
      },
      {
        name: 'Organization Level',
        context: {
          workspaceId: 'workspace-3',
          userId: 'user-3',
          collaborationLevel: 'organization' as any,
          workspaceType: 'reporting'
        }
      }
    ];

    const intent = this.smartDetection.analyzeIntent('Track project progress');
    const dataPattern = {
      type: 'sequential' as any,
      confidence: 0.7,
      structure: { tasks: [] },
      metadata: { complexity: 'moderate' as 'simple' | 'moderate' | 'complex', dataQuality: 'medium' as 'high' | 'medium' | 'low' }
    };

    contexts.forEach(({ name, context }) => {
      console.log(`\n${name}:`);
      const recommendations = this.smartDetection['getContextAwareRecommendations'](intent, dataPattern, context);
      recommendations.forEach((rec, index) => {
        console.log(`  Recommendation ${index + 1}: ${rec.type} (${rec.reasoning})`);
      });
    });
  }

  private async demoComplexScenarios() {
    console.log('\n🌟 Complex Real-World Scenarios');
    
    const complexScenarios = [
      {
        name: 'Enterprise Analytics Dashboard',
        prompt: 'Create a comprehensive analytics dashboard for our enterprise that tracks sales performance, customer satisfaction, and team productivity with real-time updates and collaborative features',
        expectedBlocks: ['chart', 'table', 'kanban', 'smart-notes-sticky', 'text']
      },
      {
        name: 'Product Development Workflow',
        prompt: 'Design a complete product development workflow that includes ideation, research, design, development, testing, and launch phases with progress tracking and team collaboration',
        expectedBlocks: ['kanban', 'timeline', 'list', 'text', 'status']
      },
      {
        name: 'Marketing Campaign Management',
        prompt: 'Build a marketing campaign management system that tracks multiple campaigns, their performance metrics, budget allocation, and team assignments with reporting capabilities',
        expectedBlocks: ['table', 'chart', 'kanban', 'calendar', 'text']
      },
      {
        name: 'Learning Management System',
        prompt: 'Create a learning management system for our training program that tracks course progress, assessments, certifications, and student performance with collaborative learning features',
        expectedBlocks: ['list', 'table', 'chart', 'smart-notes-sticky', 'text']
      }
    ];

    complexScenarios.forEach(scenario => {
      console.log(`\n${scenario.name}:`);
      console.log(`Prompt: "${scenario.prompt}"`);
      
      const intent = this.smartDetection.analyzeIntent(scenario.prompt);
      console.log(`Detected Intent: ${intent.primaryIntent}`);
      console.log(`Complexity: ${intent.complexity}`);
      console.log(`Domain: ${intent.domain}`);
      console.log(`Use Case: ${intent.useCase}`);
      
      const dataPattern = {
        type: 'mixed' as any,
        confidence: 0.6,
        structure: null,
        metadata: { complexity: intent.complexity, dataQuality: 'medium' as 'high' | 'medium' | 'low' }
      };
      
      const recommendations = this.smartDetection.generateBlockRecommendations(intent, dataPattern);
      console.log(`Recommended Blocks: ${recommendations.map(r => r.type).join(', ')}`);
      console.log(`Expected Blocks: ${scenario.expectedBlocks.join(', ')}`);
      
      // Check if recommendations match expectations
      const matchCount = recommendations.filter(r => scenario.expectedBlocks.includes(r.type)).length;
      const matchPercentage = (matchCount / scenario.expectedBlocks.length) * 100;
      console.log(`Match Rate: ${matchPercentage.toFixed(1)}%`);
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
  demo.runComprehensiveDemo().then(() => {
    console.log('✅ Smart Detection Demo Complete');
  });
} 
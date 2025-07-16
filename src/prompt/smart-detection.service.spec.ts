import { Test, TestingModule } from '@nestjs/testing';
import { SmartDetectionService } from './smart-detection.service';

describe('SmartDetectionService', () => {
  let service: SmartDetectionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SmartDetectionService],
    }).compile();

    service = module.get<SmartDetectionService>(SmartDetectionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Kanban Trigger Logic', () => {
    describe('Should NOT trigger Kanban for informational requests', () => {
      const informationalPrompts = [
        'what are the technical workflows?',
        'explain the workflow process',
        'describe the steps in the workflow',
        'what workflow should I follow?',
        'how does the process work?',
        'what are the workflow stages?',
        'show me the workflow diagram',
        'what are the key processes?',
        'explain the development workflow'
      ];

      informationalPrompts.forEach(prompt => {
        it(`should not trigger Kanban for: "${prompt}"`, () => {
          const intent = service.analyzeIntent(prompt);
          const visualizationNeeds = intent.visualizationNeeds;
          
          // Should not include kanban in visualization needs
          expect(visualizationNeeds).not.toContain('kanban');
          
          // Should be primarily a 'view' intent, not 'track'
          expect(intent.primaryIntent).toBe('view');
        });
      });
    });

    describe('Should trigger Kanban for project/task management', () => {
      const managementPrompts = [
        'track my project progress',
        'manage project tasks',
        'implement the strategy plan',
        'track task completion',
        'manage team workflow',
        'organize project tasks',
        'project task breakdown',
        'track implementation progress',
        'manage workflow tasks',
        'organize team project',
        'coordinate project tasks',
        'kanban board for project',
        'track project milestones'
      ];

      managementPrompts.forEach(prompt => {
        it(`should trigger Kanban for: "${prompt}"`, () => {
          const intent = service.analyzeIntent(prompt);
          const visualizationNeeds = intent.visualizationNeeds;
          
          // Should include kanban in visualization needs
          expect(visualizationNeeds).toContain('kanban');
        });
      });
    });

    describe('Intent Analysis', () => {
      it('should classify implementation prompts as track intent', () => {
        const implementationPrompts = [
          'implement the 48 laws of power',
          'execute the strategy plan',
          'practice these techniques',
          'apply these principles'
        ];

        implementationPrompts.forEach(prompt => {
          const intent = service.analyzeIntent(prompt);
          expect(intent.primaryIntent).toBe('track');
        });
      });

      it('should classify informational prompts as view intent', () => {
        const viewPrompts = [
          'what are the technical workflows?',
          'show me the process steps',
          'display the workflow diagram',
          'explain the methodology'
        ];

        viewPrompts.forEach(prompt => {
          const intent = service.analyzeIntent(prompt);
          expect(intent.primaryIntent).toBe('view');
        });
      });
    });

    describe('Block Recommendations', () => {
      it('should recommend Kanban for project tracking intent', () => {
        const intent = service.analyzeIntent('track my project tasks');
        const dataPattern = service.analyzeDataStructure([
          { task: 'Task 1', status: 'in-progress' },
          { task: 'Task 2', status: 'completed' }
        ]);

        const recommendations = service.generateBlockRecommendations(intent, dataPattern);
        
        const kanbanRecommendation = recommendations.find(r => r.type === 'kanban');
        expect(kanbanRecommendation).toBeDefined();
        expect(kanbanRecommendation?.confidence).toBeGreaterThan(0.8);
      });

      it('should NOT recommend Kanban for informational tracking', () => {
        const intent = service.analyzeIntent('what are the workflow steps?');
        const dataPattern = service.analyzeDataStructure([
          { step: 'Step 1', description: 'First step' },
          { step: 'Step 2', description: 'Second step' }
        ]);

        const recommendations = service.generateBlockRecommendations(intent, dataPattern);
        
        const kanbanRecommendation = recommendations.find(r => r.type === 'kanban');
        expect(kanbanRecommendation).toBeUndefined();
      });

      it('should prefer table/text for informational requests', () => {
        const intent = service.analyzeIntent('explain the technical workflows');
        const dataPattern = service.analyzeDataStructure([
          { workflow: 'Development', description: 'Code development process' },
          { workflow: 'Testing', description: 'Quality assurance process' }
        ]);

        const recommendations = service.generateBlockRecommendations(intent, dataPattern);
        
        const tableRecommendation = recommendations.find(r => r.type === 'table');
        const textRecommendation = recommendations.find(r => r.type === 'text');
        
        expect(tableRecommendation || textRecommendation).toBeDefined();
        
        const kanbanRecommendation = recommendations.find(r => r.type === 'kanban');
        expect(kanbanRecommendation).toBeUndefined();
      });
    });

    describe('Visualization Needs Detection', () => {
      it('should detect specific workflow management triggers', () => {
        const prompt = 'manage the development workflow tasks';
        const intent = service.analyzeIntent(prompt);
        
        expect(intent.visualizationNeeds).toContain('kanban');
      });

      it('should not detect broad workflow information triggers', () => {
        const prompt = 'what is the development workflow process?';
        const intent = service.analyzeIntent(prompt);
        
        expect(intent.visualizationNeeds).not.toContain('kanban');
      });

      it('should detect project organization triggers', () => {
        const prompt = 'organize project tasks and milestones';
        const intent = service.analyzeIntent(prompt);
        
        expect(intent.visualizationNeeds).toContain('kanban');
      });

      it('should not detect general organization requests', () => {
        const prompt = 'organize this information for me';
        const intent = service.analyzeIntent(prompt);
        
        expect(intent.visualizationNeeds).not.toContain('kanban');
      });
    });

    describe('Secondary Intent Detection', () => {
      it('should identify project tracking context', () => {
        const intent = service.analyzeIntent('track project implementation progress');
        
        expect(intent.secondaryIntents).toContain('project');
        expect(intent.primaryIntent).toBe('track');
      });

      it('should distinguish between project tracking and information viewing', () => {
        const trackingIntent = service.analyzeIntent('track project tasks');
        const viewingIntent = service.analyzeIntent('view project information');
        
        expect(trackingIntent.primaryIntent).toBe('track');
        expect(viewingIntent.primaryIntent).toBe('view');
      });
    });
  });

  describe('Data Transformation', () => {
    it('should transform implementation data to Kanban format', () => {
      const implementationData = [
        {
          law_number: 1,
          law_title: 'Never Outshine the Master',
          description: 'Always make those above you feel comfortably superior',
          implementation_strategy: 'Practice humility in meetings'
        },
        {
          law_number: 2,
          law_title: 'Never Put Too Much Trust in Friends',
          description: 'Learn to use enemies',
          implementation_strategy: 'Be cautious about business partnerships'
        }
      ];

      const transformed = service.transformDataForBlock(implementationData, 'kanban');
      
      expect(transformed.columns).toBeDefined();
      expect(transformed.columns.length).toBeGreaterThan(0);
      expect(transformed.columns[0].items.length).toBe(2);
      expect(transformed.columns[0].items[0].title).toContain('Never Outshine the Master');
    });

    it('should create appropriate Kanban columns for implementation', () => {
      const data = [{ task: 'Task 1', description: 'Description 1' }];
      const transformed = service.transformDataForBlock(data, 'kanban');
      
      const columnTitles = transformed.columns.map((col: any) => col.title);
      expect(columnTitles).toContain('Not Started');
      expect(columnTitles).toContain('In Progress');
      expect(columnTitles).toContain('Practicing');
      expect(columnTitles).toContain('Mastered');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty data gracefully', () => {
      const intent = service.analyzeIntent('track my tasks');
      const dataPattern = service.analyzeDataStructure([]);
      
      const recommendations = service.generateBlockRecommendations(intent, dataPattern);
      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('should handle null data gracefully', () => {
      const intent = service.analyzeIntent('manage project');
      const dataPattern = service.analyzeDataStructure(null);
      
      const recommendations = service.generateBlockRecommendations(intent, dataPattern);
      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('should handle mixed intent prompts', () => {
      const intent = service.analyzeIntent('view and track project workflow tasks');
      
      // Should prioritize the more specific intent
      expect(['view', 'track']).toContain(intent.primaryIntent);
      expect(intent.secondaryIntents.length).toBeGreaterThan(0);
    });
  });
}); 
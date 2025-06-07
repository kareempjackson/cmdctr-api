import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { WeaviateService } from '../src/vector/weaviate.service';
import { ConfigService } from '../src/config/config.service';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting comprehensive seed...');

  // Clean existing data (optional - comment out if you want to keep existing data)
  console.log('🧹 Cleaning existing data...');
  await prisma.notificationDigest.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.noteTag.deleteMany();
  await prisma.jot.deleteMany();
  await prisma.note.deleteMany();
  await prisma.canvasBlock.deleteMany();
  await prisma.canvasLayout.deleteMany();
  await prisma.block.deleteMany();
  await prisma.canvas.deleteMany();
  await prisma.projectAgent.deleteMany();
  await prisma.project.deleteMany();
  await prisma.knowledgeTraining.deleteMany();
  await prisma.knowledgeAgentAccess.deleteMany();
  await prisma.knowledgeTag.deleteMany();
  await prisma.knowledgeEntry.deleteMany();
  await prisma.auditTrail.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.agentTrainingFile.deleteMany();
  await prisma.agentMemory.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.loginEvent.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();

  // 1. Create Test Users
  console.log('👥 Creating test users...');
  
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  const ceoUser = await prisma.user.create({
    data: {
      email: 'sarah.chen@acmecorp.com',
      password: hashedPassword,
      name: 'Sarah Chen',
      role: 'CEO',
      verified: true,
      onboarded: true,
      hasSeenJoyride: true,
    },
  });

  const ctoUser = await prisma.user.create({
    data: {
      email: 'alex.rodriguez@acmecorp.com',
      password: hashedPassword,
      name: 'Alex Rodriguez',
      role: 'CTO',
      verified: true,
      onboarded: true,
      hasSeenJoyride: true,
    },
  });

  const productManager = await prisma.user.create({
    data: {
      email: 'jamie.kim@acmecorp.com',
      password: hashedPassword,
      name: 'Jamie Kim',
      role: 'Product Manager',
      verified: true,
      onboarded: true,
      hasSeenJoyride: false,
    },
  });

  const developer = await prisma.user.create({
    data: {
      email: 'morgan.taylor@acmecorp.com',
      password: hashedPassword,
      name: 'Morgan Taylor',
      role: 'Senior Developer',
      verified: true,
      onboarded: true,
      hasSeenJoyride: true,
    },
  });

  const analyst = await prisma.user.create({
    data: {
      email: 'riley.johnson@acmecorp.com',
      password: hashedPassword,
      name: 'Riley Johnson',
      role: 'Data Analyst',
      verified: true,
      onboarded: true,
      hasSeenJoyride: false,
    },
  });

  // 2. Create Test Workspace
  console.log('🏢 Creating test workspace...');
  
  const workspace = await prisma.workspace.create({
    data: {
      name: 'Acme Corp - AI Command Center',
      createdBy: ceoUser.id,
    },
  });

  // 3. Add Workspace Members
  console.log('👥 Adding workspace members...');
  
  await prisma.workspaceMember.createMany({
    data: [
      { userId: ceoUser.id, workspaceId: workspace.id, role: 'owner' },
      { userId: ctoUser.id, workspaceId: workspace.id, role: 'admin' },
      { userId: productManager.id, workspaceId: workspace.id, role: 'member' },
      { userId: developer.id, workspaceId: workspace.id, role: 'member' },
      { userId: analyst.id, workspaceId: workspace.id, role: 'member' },
    ],
  });

  // 4. Create Knowledge Tags
  console.log('🏷️ Creating knowledge tags...');
  
  const tags = await Promise.all([
    prisma.knowledgeTag.create({
      data: { name: 'Product Strategy', color: '#3B82F6', workspaceId: workspace.id },
    }),
    prisma.knowledgeTag.create({
      data: { name: 'Technical Documentation', color: '#10B981', workspaceId: workspace.id },
    }),
    prisma.knowledgeTag.create({
      data: { name: 'Market Research', color: '#F59E0B', workspaceId: workspace.id },
    }),
    prisma.knowledgeTag.create({
      data: { name: 'Customer Support', color: '#EF4444', workspaceId: workspace.id },
    }),
    prisma.knowledgeTag.create({
      data: { name: 'Sales Process', color: '#8B5CF6', workspaceId: workspace.id },
    }),
    prisma.knowledgeTag.create({
      data: { name: 'Company Policies', color: '#6B7280', workspaceId: workspace.id },
    }),
  ]);

  // 5. Create Knowledge Base Entries
  console.log('📚 Creating knowledge base entries...');
  
  const knowledgeEntries = await Promise.all([
    // Product Strategy Documents
    prisma.knowledgeEntry.create({
      data: {
        workspaceId: workspace.id,
        type: 'document',
        title: 'Product Roadmap 2024-2025',
        description: 'Comprehensive product roadmap outlining key features and milestones',
        content: `# Product Roadmap 2024-2025

## Q1 2024 Objectives
- Launch AI-powered analytics dashboard
- Implement real-time collaboration features
- Enhance mobile application performance
- Integrate with 5 major CRM platforms

## Q2 2024 Objectives
- Advanced AI agent capabilities
- Custom workflow automation
- Enhanced security features
- International market expansion

## Q3 2024 Objectives
- Machine learning model improvements
- Advanced reporting and insights
- API marketplace launch
- Enterprise-grade compliance features

## Q4 2024 Objectives
- Next-generation user interface
- Advanced integration capabilities
- Performance optimization
- Market expansion to APAC region

## 2025 Vision
- Industry-leading AI platform
- Global market presence
- Advanced enterprise features
- Sustainable growth model`,
        status: 'published',
        createdBy: productManager.id,
        lastModifiedBy: productManager.id,
        trainingStatus: 'trained',
        lastTrainedAt: new Date(),
        tags: { connect: [{ id: tags[0].id }] },
      },
    }),

    // Technical Documentation
    prisma.knowledgeEntry.create({
      data: {
        workspaceId: workspace.id,
        type: 'document',
        title: 'API Documentation & Best Practices',
        description: 'Complete API documentation with implementation examples',
        content: `# API Documentation & Best Practices

## Authentication
All API requests require authentication using JWT tokens.

\`\`\`javascript
const response = await fetch('/api/endpoint', {
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  }
});
\`\`\`

## Core Endpoints

### Users API
- GET /api/users - List all users
- POST /api/users - Create new user
- PUT /api/users/:id - Update user
- DELETE /api/users/:id - Delete user

### Agents API
- GET /api/agents - List all agents
- POST /api/agents - Create new agent
- PUT /api/agents/:id - Update agent configuration
- POST /api/agents/:id/execute - Execute agent task

### Knowledge Base API
- GET /api/knowledge - List knowledge entries
- POST /api/knowledge - Create knowledge entry
- PUT /api/knowledge/:id - Update knowledge entry
- POST /api/knowledge/:id/train - Train AI model

## Rate Limiting
- 1000 requests per hour for authenticated users
- 100 requests per hour for unauthenticated requests

## Error Handling
All errors return standardized JSON responses with appropriate HTTP status codes.`,
        status: 'published',
        createdBy: developer.id,
        lastModifiedBy: ctoUser.id,
        trainingStatus: 'trained',
        lastTrainedAt: new Date(),
        tags: { connect: [{ id: tags[1].id }] },
      },
    }),

    // Market Research
    prisma.knowledgeEntry.create({
      data: {
        workspaceId: workspace.id,
        type: 'document',
        title: 'Competitive Analysis Report 2024',
        description: 'Detailed analysis of competitors and market positioning',
        content: `# Competitive Analysis Report 2024

## Market Overview
The AI-powered business automation market is experiencing rapid growth with a projected CAGR of 35% through 2027.

## Key Competitors

### Competitor A - TechFlow
- **Strengths**: Strong enterprise presence, robust security
- **Weaknesses**: Limited AI capabilities, complex setup
- **Market Share**: 23%
- **Pricing**: $50-200/user/month

### Competitor B - AutoMate Pro
- **Strengths**: User-friendly interface, good integrations
- **Weaknesses**: Limited customization, basic AI features
- **Market Share**: 18%
- **Pricing**: $30-150/user/month

### Competitor C - WorkflowAI
- **Strengths**: Advanced AI, good analytics
- **Weaknesses**: High learning curve, expensive
- **Market Share**: 15%
- **Pricing**: $100-500/user/month

## Our Competitive Advantages
1. Superior AI agent capabilities
2. Intuitive user experience
3. Flexible pricing model
4. Rapid deployment and setup
5. Comprehensive integration ecosystem

## Market Opportunities
- Small to medium businesses (underserved segment)
- Industry-specific solutions
- International markets
- Mobile-first workflows`,
        status: 'published',
        createdBy: analyst.id,
        lastModifiedBy: analyst.id,
        trainingStatus: 'trained',
        lastTrainedAt: new Date(),
        tags: { connect: [{ id: tags[2].id }] },
      },
    }),

    // Customer Support Knowledge
    prisma.knowledgeEntry.create({
      data: {
        workspaceId: workspace.id,
        type: 'document',
        title: 'Customer Support Playbook',
        description: 'Comprehensive guide for handling customer inquiries and issues',
        content: `# Customer Support Playbook

## Response Time Standards
- Critical issues: 1 hour
- High priority: 4 hours
- Medium priority: 24 hours
- Low priority: 72 hours

## Common Issues & Solutions

### Login Problems
1. Check if user account is verified
2. Verify password reset process
3. Check for browser compatibility issues
4. Escalate to technical team if persistent

### Agent Configuration Issues
1. Review agent setup documentation
2. Check API key configuration
3. Verify workspace permissions
4. Test with sample data

### Integration Problems
1. Verify API credentials
2. Check rate limiting status
3. Review integration documentation
4. Contact integration partner if needed

## Escalation Process
1. Level 1: Front-line support
2. Level 2: Technical specialists
3. Level 3: Engineering team
4. Level 4: Product team

## Customer Communication Templates
- Initial response acknowledgment
- Status update notifications
- Resolution confirmation
- Follow-up satisfaction survey`,
        status: 'published',
        createdBy: ceoUser.id,
        lastModifiedBy: ceoUser.id,
        trainingStatus: 'trained',
        lastTrainedAt: new Date(),
        tags: { connect: [{ id: tags[3].id }] },
      },
    }),

    // Sales Process Documentation
    prisma.knowledgeEntry.create({
      data: {
        workspaceId: workspace.id,
        type: 'document',
        title: 'Sales Process & Methodology',
        description: 'Complete sales process from lead generation to closing',
        content: `# Sales Process & Methodology

## Lead Qualification Framework (BANT)
- **Budget**: Does the prospect have budget allocated?
- **Authority**: Are we speaking with decision makers?
- **Need**: Is there a clear business need?
- **Timeline**: What is the implementation timeline?

## Sales Stages

### 1. Lead Generation
- Inbound marketing campaigns
- Outbound prospecting
- Partner referrals
- Event networking

### 2. Initial Contact
- Discovery call within 24 hours
- Needs assessment questionnaire
- Product demonstration scheduling
- Stakeholder identification

### 3. Solution Design
- Custom demo preparation
- ROI calculation
- Implementation timeline
- Pricing proposal

### 4. Negotiation
- Contract terms discussion
- Pricing negotiations
- Implementation planning
- Legal review process

### 5. Closing
- Final proposal presentation
- Contract execution
- Onboarding kickoff
- Success metrics definition

## Key Metrics
- Lead to opportunity conversion: 15%
- Opportunity to close rate: 25%
- Average deal size: $50,000
- Sales cycle length: 45 days`,
        status: 'published',
        createdBy: ceoUser.id,
        lastModifiedBy: productManager.id,
        trainingStatus: 'trained',
        lastTrainedAt: new Date(),
        tags: { connect: [{ id: tags[4].id }] },
      },
    }),

    // Company Policies
    prisma.knowledgeEntry.create({
      data: {
        workspaceId: workspace.id,
        type: 'document',
        title: 'Employee Handbook & Policies',
        description: 'Company policies, procedures, and employee guidelines',
        content: `# Employee Handbook & Policies

## Company Values
1. **Innovation**: We embrace new ideas and technologies
2. **Collaboration**: We work together to achieve common goals
3. **Integrity**: We act with honesty and transparency
4. **Excellence**: We strive for the highest quality in everything we do
5. **Customer Focus**: We put our customers at the center of everything

## Work Policies

### Remote Work Policy
- Flexible work arrangements available
- Core collaboration hours: 10 AM - 3 PM local time
- Regular team check-ins required
- Home office setup allowance provided

### Time Off Policy
- Unlimited PTO with manager approval
- Minimum 2 weeks vacation per year encouraged
- Sick leave as needed
- Parental leave: 12 weeks paid

### Professional Development
- Annual learning budget: $2,000 per employee
- Conference attendance encouraged
- Internal training programs
- Mentorship opportunities

## Code of Conduct
- Respectful workplace environment
- Zero tolerance for harassment
- Confidentiality requirements
- Conflict of interest disclosure

## Security Policies
- Strong password requirements
- Two-factor authentication mandatory
- Regular security training
- Incident reporting procedures`,
        status: 'published',
        createdBy: ceoUser.id,
        lastModifiedBy: ceoUser.id,
        trainingStatus: 'trained',
        lastTrainedAt: new Date(),
        tags: { connect: [{ id: tags[5].id }] },
      },
    }),
  ]);

  // 6. Create AI Agents
  console.log('🤖 Creating AI agents...');
  
  const agents = await Promise.all([
    // Customer Support Agent
    prisma.agent.create({
      data: {
        name: 'Customer Support Assistant',
        purpose: 'Provides intelligent customer support by analyzing support tickets, suggesting solutions, and escalating complex issues to human agents.',
        workspaceId: workspace.id,
        config: {
          model: 'gpt-4',
          temperature: 0.3,
          maxTokens: 1000,
          systemPrompt: 'You are a helpful customer support assistant. Use the knowledge base to provide accurate and helpful responses to customer inquiries. Always be polite, professional, and solution-oriented.',
          capabilities: ['ticket_analysis', 'solution_suggestion', 'escalation_routing'],
          integrations: ['zendesk', 'slack', 'email'],
          responseStyle: 'professional',
          knowledgeAccess: 'customer_support',
        },
      },
    }),

    // Sales Assistant Agent
    prisma.agent.create({
      data: {
        name: 'Sales Intelligence Agent',
        purpose: 'Analyzes sales data, identifies opportunities, and provides insights to help close deals faster.',
        workspaceId: workspace.id,
        config: {
          model: 'gpt-4',
          temperature: 0.4,
          maxTokens: 1200,
          systemPrompt: 'You are a sales intelligence assistant. Help sales teams by analyzing prospects, suggesting strategies, and providing market insights based on the knowledge base.',
          capabilities: ['lead_scoring', 'opportunity_analysis', 'competitive_intelligence'],
          integrations: ['salesforce', 'hubspot', 'linkedin'],
          responseStyle: 'persuasive',
          knowledgeAccess: 'sales_marketing',
        },
      },
    }),

    // Product Strategy Agent
    prisma.agent.create({
      data: {
        name: 'Product Strategy Advisor',
        purpose: 'Provides strategic product insights, analyzes market trends, and helps with product roadmap decisions.',
        workspaceId: workspace.id,
        config: {
          model: 'gpt-4',
          temperature: 0.5,
          maxTokens: 1500,
          systemPrompt: 'You are a product strategy advisor. Analyze market data, user feedback, and competitive intelligence to provide strategic product recommendations.',
          capabilities: ['market_analysis', 'feature_prioritization', 'roadmap_planning'],
          integrations: ['jira', 'confluence', 'analytics'],
          responseStyle: 'analytical',
          knowledgeAccess: 'product_strategy',
        },
      },
    }),

    // Technical Documentation Agent
    prisma.agent.create({
      data: {
        name: 'Technical Documentation Assistant',
        purpose: 'Helps developers and technical teams by providing code examples, API documentation, and troubleshooting guidance.',
        workspaceId: workspace.id,
        config: {
          model: 'gpt-4',
          temperature: 0.2,
          maxTokens: 2000,
          systemPrompt: 'You are a technical documentation assistant. Provide accurate code examples, API documentation, and troubleshooting help based on the technical knowledge base.',
          capabilities: ['code_generation', 'api_documentation', 'troubleshooting'],
          integrations: ['github', 'gitlab', 'confluence'],
          responseStyle: 'technical',
          knowledgeAccess: 'technical_docs',
        },
      },
    }),

    // Data Analysis Agent
    prisma.agent.create({
      data: {
        name: 'Business Intelligence Agent',
        purpose: 'Analyzes business data, generates insights, and creates reports to support data-driven decision making.',
        workspaceId: workspace.id,
        config: {
          model: 'gpt-4',
          temperature: 0.3,
          maxTokens: 1800,
          systemPrompt: 'You are a business intelligence agent. Analyze data patterns, generate insights, and provide actionable recommendations based on business metrics and market research.',
          capabilities: ['data_analysis', 'report_generation', 'trend_identification'],
          integrations: ['tableau', 'powerbi', 'google_analytics'],
          responseStyle: 'analytical',
          knowledgeAccess: 'business_data',
        },
      },
    }),
  ]);

  // --- NEW: Initialize Weaviate memory classes for each agent ---
  console.log('🧠 Initializing Weaviate agent memory classes...');
  const configService = new ConfigService();
  const weaviate = new WeaviateService(configService);
  for (const agent of agents) {
    await weaviate.initAgentMemory(agent.id);
  }

  // 7. Connect Agents to Knowledge Base
  console.log('🔗 Connecting agents to knowledge base...');
  
  await Promise.all([
    // Customer Support Agent access
    prisma.knowledgeAgentAccess.create({
      data: {
        knowledgeEntryId: knowledgeEntries[3].id, // Customer Support Playbook
        agentId: agents[0].id,
        accessLevel: 'read',
      },
    }),
    prisma.knowledgeAgentAccess.create({
      data: {
        knowledgeEntryId: knowledgeEntries[5].id, // Company Policies
        agentId: agents[0].id,
        accessLevel: 'read',
      },
    }),

    // Sales Agent access
    prisma.knowledgeAgentAccess.create({
      data: {
        knowledgeEntryId: knowledgeEntries[2].id, // Market Research
        agentId: agents[1].id,
        accessLevel: 'read',
      },
    }),
    prisma.knowledgeAgentAccess.create({
      data: {
        knowledgeEntryId: knowledgeEntries[4].id, // Sales Process
        agentId: agents[1].id,
        accessLevel: 'read',
      },
    }),

    // Product Strategy Agent access
    prisma.knowledgeAgentAccess.create({
      data: {
        knowledgeEntryId: knowledgeEntries[0].id, // Product Roadmap
        agentId: agents[2].id,
        accessLevel: 'read',
      },
    }),
    prisma.knowledgeAgentAccess.create({
      data: {
        knowledgeEntryId: knowledgeEntries[2].id, // Market Research
        agentId: agents[2].id,
        accessLevel: 'read',
      },
    }),

    // Technical Agent access
    prisma.knowledgeAgentAccess.create({
      data: {
        knowledgeEntryId: knowledgeEntries[1].id, // API Documentation
        agentId: agents[3].id,
        accessLevel: 'read',
      },
    }),

    // Business Intelligence Agent access
    prisma.knowledgeAgentAccess.create({
      data: {
        knowledgeEntryId: knowledgeEntries[2].id, // Market Research
        agentId: agents[4].id,
        accessLevel: 'read',
      },
    }),
  ]);

  // 8. Create Projects
  console.log('📋 Creating test projects...');
  
  const projects = await Promise.all([
    prisma.project.create({
      data: {
        name: 'Q1 Product Launch',
        slug: 'q1-product-launch',
        workspaceId: workspace.id,
        ownerId: productManager.id,
        description: 'Launch of new AI-powered analytics dashboard for Q1 2024',
        aiContext: 'Product launch project focusing on AI analytics dashboard with real-time collaboration features',
        colorTheme: '#3B82F6',
        status: 'active',
        isPublic: false,
      },
    }),

    prisma.project.create({
      data: {
        name: 'Customer Onboarding Optimization',
        slug: 'customer-onboarding-optimization',
        workspaceId: workspace.id,
        ownerId: ceoUser.id,
        description: 'Improve customer onboarding process and reduce time-to-value',
        aiContext: 'Customer success project aimed at optimizing onboarding workflows and improving user experience',
        colorTheme: '#10B981',
        status: 'active',
        isPublic: false,
      },
    }),

    prisma.project.create({
      data: {
        name: 'API Platform Enhancement',
        slug: 'api-platform-enhancement',
        workspaceId: workspace.id,
        ownerId: ctoUser.id,
        description: 'Enhance API platform with new endpoints and improved performance',
        aiContext: 'Technical project focused on API improvements, performance optimization, and new feature development',
        colorTheme: '#8B5CF6',
        status: 'active',
        isPublic: false,
      },
    }),
  ]);

  // 9. Assign Agents to Projects
  console.log('🤝 Assigning agents to projects...');
  
  await Promise.all([
    // Q1 Product Launch project agents
    prisma.projectAgent.create({
      data: {
        projectId: projects[0].id,
        agentId: agents[2].id, // Product Strategy Advisor
        role: 'strategy_advisor',
        isActive: true,
        config: { focus: 'product_launch', priority: 'high' },
      },
    }),
    prisma.projectAgent.create({
      data: {
        projectId: projects[0].id,
        agentId: agents[4].id, // Business Intelligence Agent
        role: 'analytics_advisor',
        isActive: true,
        config: { focus: 'launch_metrics', priority: 'medium' },
      },
    }),

    // Customer Onboarding project agents
    prisma.projectAgent.create({
      data: {
        projectId: projects[1].id,
        agentId: agents[0].id, // Customer Support Assistant
        role: 'support_advisor',
        isActive: true,
        config: { focus: 'onboarding_support', priority: 'high' },
      },
    }),
    prisma.projectAgent.create({
      data: {
        projectId: projects[1].id,
        agentId: agents[4].id, // Business Intelligence Agent
        role: 'metrics_advisor',
        isActive: true,
        config: { focus: 'onboarding_analytics', priority: 'medium' },
      },
    }),

    // API Platform project agents
    prisma.projectAgent.create({
      data: {
        projectId: projects[2].id,
        agentId: agents[3].id, // Technical Documentation Assistant
        role: 'technical_advisor',
        isActive: true,
        config: { focus: 'api_documentation', priority: 'high' },
      },
    }),
  ]);

  // 10. Create Canvases for Projects
  console.log('🎨 Creating project canvases...');
  
  const canvases = await Promise.all([
    // Q1 Product Launch Canvas
    prisma.canvas.create({
      data: {
        name: 'Product Launch Dashboard',
        projectId: projects[0].id,
        type: 'custom',
        description: 'Main dashboard for tracking product launch progress',
        createdBy: productManager.id,
        config: {
          theme: 'modern',
          layout: 'grid',
          columns: 3,
          spacing: 'medium',
        },
        aiContext: 'Product launch tracking dashboard with KPIs, timeline, and team collaboration',
        layout: 'grid',
        isTemplate: false,
        isPublic: false,
      },
    }),

    // Customer Onboarding Canvas
    prisma.canvas.create({
      data: {
        name: 'Onboarding Process Flow',
        projectId: projects[1].id,
        type: 'kanban',
        description: 'Kanban board for managing customer onboarding workflow',
        createdBy: ceoUser.id,
        config: {
          theme: 'clean',
          columns: ['New Customers', 'In Progress', 'Training', 'Completed'],
          autoAssign: true,
        },
        aiContext: 'Customer onboarding workflow management with automated task assignment',
        layout: 'linear',
        isTemplate: false,
        isPublic: false,
      },
    }),

    // API Platform Canvas
    prisma.canvas.create({
      data: {
        name: 'API Development Board',
        projectId: projects[2].id,
        type: 'table',
        description: 'Development tracking table for API enhancements',
        createdBy: ctoUser.id,
        config: {
          theme: 'technical',
          sortBy: 'priority',
          filters: ['status', 'assignee', 'priority'],
          groupBy: 'component',
        },
        aiContext: 'API development tracking with technical specifications and progress monitoring',
        layout: 'freeform',
        isTemplate: false,
        isPublic: false,
      },
    }),
  ]);

  // 11. Create Blocks for Canvases
  console.log('🧱 Creating canvas blocks...');
  
  await Promise.all([
    // Product Launch Dashboard Blocks
    prisma.block.create({
      data: {
        canvasId: canvases[0].id,
        type: 'chart',
        order: 1,
        x: 0,
        y: 0,
        width: 400,
        height: 300,
        title: 'Launch Progress',
        content: {
          chartType: 'progress',
          data: {
            completed: 65,
            total: 100,
            milestones: [
              { name: 'Design Complete', status: 'completed' },
              { name: 'Development', status: 'in_progress' },
              { name: 'Testing', status: 'pending' },
              { name: 'Launch', status: 'pending' },
            ],
          },
        },
        config: {
          showPercentage: true,
          colorScheme: 'blue',
          animated: true,
        },
        createdBy: productManager.id,
      },
    }),

    prisma.block.create({
      data: {
        canvasId: canvases[0].id,
        type: 'agent',
        order: 2,
        x: 420,
        y: 0,
        width: 380,
        height: 300,
        title: 'Product Strategy Insights',
        content: {
          agentId: agents[2].id,
          lastUpdate: new Date().toISOString(),
          insights: [
            'Market analysis shows strong demand for AI analytics',
            'Competitor analysis suggests pricing advantage',
            'User feedback indicates high satisfaction with beta features',
          ],
        },
        config: {
          autoRefresh: true,
          refreshInterval: 300,
          showTimestamp: true,
        },
        createdBy: productManager.id,
      },
    }),

    prisma.block.create({
      data: {
        canvasId: canvases[0].id,
        type: 'table',
        order: 3,
        x: 0,
        y: 320,
        width: 800,
        height: 250,
        title: 'Team Tasks',
        content: {
          headers: ['Task', 'Assignee', 'Status', 'Due Date'],
          rows: [
            ['UI/UX Design Review', 'Jamie Kim', 'Completed', '2024-01-15'],
            ['Backend API Development', 'Morgan Taylor', 'In Progress', '2024-01-25'],
            ['Frontend Integration', 'Morgan Taylor', 'Pending', '2024-02-01'],
            ['Quality Assurance Testing', 'Riley Johnson', 'Pending', '2024-02-05'],
            ['Documentation Update', 'Alex Rodriguez', 'In Progress', '2024-01-30'],
          ],
        },
        config: {
          sortable: true,
          filterable: true,
          editable: false,
        },
        createdBy: productManager.id,
      },
    }),

    // Customer Onboarding Kanban Blocks
    prisma.block.create({
      data: {
        canvasId: canvases[1].id,
        type: 'kanban',
        order: 1,
        x: 0,
        y: 0,
        width: 1000,
        height: 600,
        title: 'Customer Onboarding Pipeline',
        content: {
          columns: [
            {
              id: 'new',
              title: 'New Customers',
              cards: [
                { id: '1', title: 'Acme Industries', description: 'Enterprise client - 500 users', priority: 'high' },
                { id: '2', title: 'TechStart Inc', description: 'Startup - 50 users', priority: 'medium' },
              ],
            },
            {
              id: 'progress',
              title: 'In Progress',
              cards: [
                { id: '3', title: 'Global Corp', description: 'Mid-market - 200 users', priority: 'high' },
                { id: '4', title: 'Local Business', description: 'Small business - 25 users', priority: 'low' },
              ],
            },
            {
              id: 'training',
              title: 'Training',
              cards: [
                { id: '5', title: 'Innovation Labs', description: 'Research org - 100 users', priority: 'medium' },
              ],
            },
            {
              id: 'completed',
              title: 'Completed',
              cards: [
                { id: '6', title: 'Success Stories Co', description: 'Completed successfully', priority: 'completed' },
              ],
            },
          ],
        },
        config: {
          allowDragDrop: true,
          showCardCount: true,
          autoAssign: true,
        },
        createdBy: ceoUser.id,
      },
    }),

    // API Development Table Block
    prisma.block.create({
      data: {
        canvasId: canvases[2].id,
        type: 'table',
        order: 1,
        x: 0,
        y: 0,
        width: 1200,
        height: 500,
        title: 'API Enhancement Tracker',
        content: {
          headers: ['Endpoint', 'Method', 'Status', 'Priority', 'Assignee', 'Completion'],
          rows: [
            ['/api/agents/execute', 'POST', 'In Development', 'High', 'Morgan Taylor', '75%'],
            ['/api/knowledge/search', 'GET', 'Testing', 'High', 'Morgan Taylor', '90%'],
            ['/api/canvas/blocks', 'PUT', 'Planning', 'Medium', 'Alex Rodriguez', '25%'],
            ['/api/notifications/bulk', 'POST', 'Completed', 'Low', 'Morgan Taylor', '100%'],
            ['/api/analytics/dashboard', 'GET', 'In Development', 'High', 'Riley Johnson', '60%'],
          ],
        },
        config: {
          sortable: true,
          filterable: true,
          editable: true,
          groupBy: 'status',
        },
        createdBy: ctoUser.id,
      },
    }),
  ]);

  // 12. Create Sample Agent Memories
  console.log('🧠 Creating agent memories...');
  
  await Promise.all([
    prisma.agentMemory.create({
      data: {
        agentId: agents[0].id, // Customer Support Assistant
        input: 'How do I reset my password?',
        output: 'To reset your password, please follow these steps: 1) Go to the login page, 2) Click "Forgot Password", 3) Enter your email address, 4) Check your email for reset instructions, 5) Follow the link and create a new password. If you continue to have issues, please contact our support team.',
      },
    }),

    prisma.agentMemory.create({
      data: {
        agentId: agents[1].id, // Sales Intelligence Agent
        input: 'What is our competitive advantage over TechFlow?',
        output: 'Based on our competitive analysis, we have several key advantages over TechFlow: 1) Superior AI capabilities with more advanced machine learning models, 2) More intuitive user interface requiring less training, 3) Flexible pricing model that scales with business needs, 4) Faster implementation time (2-3 weeks vs 6-8 weeks), 5) Better integration ecosystem with 50+ native connectors.',
      },
    }),

    prisma.agentMemory.create({
      data: {
        agentId: agents[2].id, // Product Strategy Advisor
        input: 'Should we prioritize mobile app development for Q2?',
        output: 'Based on market research and user feedback analysis, mobile app development should be a high priority for Q2. Key factors: 1) 40% of user requests mention mobile access, 2) Competitors are investing heavily in mobile, 3) Mobile users show 25% higher engagement rates, 4) Enterprise clients increasingly require mobile solutions for field teams. Recommend allocating 30% of development resources to mobile initiative.',
      },
    }),
  ]);

  // 13. Create Activity Logs
  console.log('📊 Creating activity logs...');
  
  await Promise.all([
    prisma.activityLog.create({
      data: {
        userId: ceoUser.id,
        workspaceId: workspace.id,
        category: 'workspace',
        action: 'create',
        resource: workspace.id,
        description: 'Created new workspace: Acme Corp - AI Command Center',
        status: 'success',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
    }),

    prisma.activityLog.create({
      data: {
        userId: productManager.id,
        workspaceId: workspace.id,
        agentId: agents[2].id,
        category: 'agent',
        action: 'create',
        resource: agents[2].id,
        description: 'Created Product Strategy Advisor agent',
        status: 'success',
        ipAddress: '192.168.1.101',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    }),

    prisma.activityLog.create({
      data: {
        userId: developer.id,
        workspaceId: workspace.id,
        category: 'knowledge',
        action: 'upload',
        resource: knowledgeEntries[1].id,
        description: 'Uploaded API Documentation & Best Practices',
        status: 'success',
        duration: 2500,
        ipAddress: '192.168.1.102',
        userAgent: 'Mozilla/5.0 (Linux; Ubuntu)',
      },
    }),
  ]);

  // 14. Create Notes
  console.log('📝 Creating sample notes...');
  
  await Promise.all([
    prisma.note.create({
      data: {
        title: 'Q1 Launch Strategy Meeting Notes',
        content: `# Q1 Launch Strategy Meeting - January 15, 2024

## Attendees
- Sarah Chen (CEO)
- Jamie Kim (Product Manager)
- Alex Rodriguez (CTO)
- Morgan Taylor (Senior Developer)

## Key Decisions
1. **Launch Date**: February 28, 2024
2. **Target Market**: Mid-market companies (100-500 employees)
3. **Pricing Strategy**: Freemium model with premium features
4. **Marketing Approach**: Content marketing + partner channels

## Action Items
- [ ] Finalize feature set by January 20
- [ ] Complete beta testing by February 10
- [ ] Prepare launch materials by February 15
- [ ] Set up analytics tracking by February 20

## Risks & Mitigation
- **Risk**: Competitor launch in same timeframe
- **Mitigation**: Accelerate unique AI features development

## Next Meeting
January 22, 2024 - Progress review`,
        workspaceId: workspace.id,
        createdBy: productManager.id,
        isPinned: true,
      },
    }),

    prisma.note.create({
      data: {
        title: 'Customer Feedback Analysis',
        content: `# Customer Feedback Analysis - January 2024

## Overall Satisfaction: 4.2/5

## Top Positive Feedback
1. **Ease of Use** (mentioned 45 times)
   - "Intuitive interface"
   - "Quick setup process"
   - "Minimal learning curve"

2. **AI Capabilities** (mentioned 38 times)
   - "Intelligent automation"
   - "Accurate predictions"
   - "Time-saving insights"

3. **Integration Quality** (mentioned 32 times)
   - "Seamless CRM integration"
   - "Works well with existing tools"
   - "API is well-documented"

## Areas for Improvement
1. **Mobile Experience** (mentioned 28 times)
   - Need native mobile app
   - Better responsive design
   - Offline capabilities

2. **Reporting Features** (mentioned 22 times)
   - More customizable dashboards
   - Advanced filtering options
   - Export capabilities

## Recommended Actions
- Prioritize mobile app development
- Enhance reporting module
- Improve onboarding tutorials`,
        workspaceId: workspace.id,
        createdBy: analyst.id,
        isPinned: false,
      },
    }),
  ]);

  // 15. Create Knowledge Training Records
  console.log('🎓 Creating knowledge training records...');
  
  await Promise.all([
    prisma.knowledgeTraining.create({
      data: {
        knowledgeEntryId: knowledgeEntries[0].id,
        status: 'completed',
        startedAt: new Date(Date.now() - 3600000), // 1 hour ago
        completedAt: new Date(Date.now() - 1800000), // 30 minutes ago
        metrics: {
          accuracy: 0.95,
          confidence: 0.88,
          processingTime: 1800,
          tokensProcessed: 15000,
        },
        triggeredBy: productManager.id,
      },
    }),

    prisma.knowledgeTraining.create({
      data: {
        knowledgeEntryId: knowledgeEntries[1].id,
        status: 'completed',
        startedAt: new Date(Date.now() - 7200000), // 2 hours ago
        completedAt: new Date(Date.now() - 5400000), // 1.5 hours ago
        metrics: {
          accuracy: 0.92,
          confidence: 0.91,
          processingTime: 1800,
          tokensProcessed: 12000,
        },
        triggeredBy: developer.id,
      },
    }),
  ]);

  console.log('✅ Seed completed successfully!');
  console.log('\n📋 Summary of created data:');
  console.log(`👥 Users: 5 (CEO, CTO, Product Manager, Developer, Analyst)`);
  console.log(`🏢 Workspace: 1 (Acme Corp - AI Command Center)`);
  console.log(`🤖 AI Agents: 5 (Support, Sales, Product, Technical, BI)`);
  console.log(`📚 Knowledge Entries: 6 (Product, Technical, Market, Support, Sales, Policies)`);
  console.log(`🏷️ Knowledge Tags: 6 (Strategy, Technical, Research, Support, Sales, Policies)`);
  console.log(`📋 Projects: 3 (Product Launch, Onboarding, API Enhancement)`);
  console.log(`🎨 Canvases: 3 (Dashboard, Kanban, Table)`);
  console.log(`🧱 Blocks: 5 (Charts, Agent insights, Tables, Kanban)`);
  console.log(`📝 Notes: 2 (Meeting notes, Customer feedback)`);
  console.log(`🧠 Agent Memories: 3 (Sample conversations)`);
  console.log(`📊 Activity Logs: 3 (Sample activities)`);
  console.log(`🎓 Training Records: 2 (Completed trainings)`);
  
  console.log('\n🔑 Test Login Credentials:');
  console.log('Email: sarah.chen@acmecorp.com | Password: password123 (CEO)');
  console.log('Email: alex.rodriguez@acmecorp.com | Password: password123 (CTO)');
  console.log('Email: jamie.kim@acmecorp.com | Password: password123 (Product Manager)');
  console.log('Email: morgan.taylor@acmecorp.com | Password: password123 (Developer)');
  console.log('Email: riley.johnson@acmecorp.com | Password: password123 (Analyst)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 
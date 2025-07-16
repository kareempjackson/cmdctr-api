# Natural Language Workflows & Backend Integrations Plan

## 🎯 **Vision: Natural Language to Automated Workflows**

### **Problem**
- Current: Visual workflow builder requires technical setup
- Users want: "Send email when X happens" → Workflow created automatically  
- Goal: Natural language → Intelligent workflow generation + Real task execution

---

## 🔄 **Natural Language Workflow Creation**

### **User Experience**
```
Input: "When someone fills out our contact form, send them a welcome email, 
       create a lead in HubSpot, and notify the sales team in Slack"

Output: Intelligent workflow with:
├─ Trigger: Form submission detected
├─ Step 1: Send personalized welcome email
├─ Step 2: Create HubSpot lead record  
├─ Step 3: Post notification in #sales Slack channel
└─ Settings: Error handling, retry logic, notifications
```

### **Technical Implementation**

#### **Frontend Components**
```typescript
// 1. NaturalWorkflowModal.tsx
interface NaturalWorkflowModalProps {
  onWorkflowCreated: (workflow: Workflow) => void;
  onClose: () => void;
}

// Features:
- Large textarea for natural language input
- AI-powered workflow analysis and preview
- Smart trigger detection (time-based, event-based, manual)
- Step-by-step preview with editable parameters
- Integration requirements detection
```

#### **Backend API Extensions**
```typescript
// New endpoints:
POST /workflows/analyze-natural-language
POST /workflows/create-from-description
GET  /workflows/suggested-templates

// AnalyzeWorkflowDto
interface AnalyzeWorkflowRequest {
  description: string;
  workspaceId: string;
  agentId?: string;
}

interface AnalyzeWorkflowResponse {
  understanding: string;
  detectedTrigger: TriggerType;
  proposedSteps: WorkflowStep[];
  requiredIntegrations: string[];
  estimatedSetupTime: string;
  confidence: number;
}
```

### **AI-Powered Workflow Analysis**
```typescript
// Intelligent parsing of natural language:

"When a new lead signs up" → 
  Trigger: webhook/form-submission
  
"send welcome email" → 
  Action: email-service
  Parameters: template, recipient
  
"create CRM entry" → 
  Action: crm-integration  
  Parameters: lead data mapping
  
"assign to sales rep" → 
  Action: user-assignment
  Parameters: routing rules
```

---

## 🔌 **Backend Integrations for Real Task Execution**

### **Current State Analysis**
```typescript
✅ Available:
- HTTP requests (basic API calls)
- File operations (read/write/list)
- System commands  
- Database queries
- Internal notifications

❌ Missing Real-World Integrations:
- Email service (SendGrid, AWS SES)
- Calendar (Google Calendar, Outlook)
- Slack (real API integration)
- CRM (Salesforce, HubSpot)
- Document creation (Google Docs, Office 365)
- Project management (Asana, Notion, Trello)
```

### **Priority Integration Categories**

#### **🚨 Tier 1: Essential Communications**
```typescript
// Email Service Integration
providers: ['SendGrid', 'AWS SES', 'Mailgun', 'Postmark']
actions: ['send_email', 'send_template', 'send_bulk']
config: {
  apiKey: string;
  fromEmail: string;
  templates: EmailTemplate[];
}

// Slack Integration  
actions: ['post_message', 'create_channel', 'invite_users']
config: {
  botToken: string;
  workspaceId: string;
  defaultChannels: string[];
}

// Calendar Integration
providers: ['Google Calendar', 'Outlook', 'CalDAV']
actions: ['create_event', 'update_event', 'check_availability']
auth: OAuth2 + refresh tokens
```

#### **🔥 Tier 2: Business Operations**
```typescript
// CRM Integrations
providers: ['HubSpot', 'Salesforce', 'Pipedrive']
actions: ['create_lead', 'update_contact', 'create_deal']

// Document Creation
providers: ['Google Docs', 'Office 365', 'Notion'] 
actions: ['create_document', 'update_content', 'share_document']

// Project Management
providers: ['Asana', 'Trello', 'Monday.com']
actions: ['create_task', 'update_status', 'assign_user']
```

#### **⚡ Tier 3: Advanced Automation**
```typescript
// Webhooks & Events
actions: ['listen_webhook', 'send_webhook', 'schedule_trigger']

// AI/ML Services  
providers: ['OpenAI', 'Anthropic', 'Azure Cognitive']
actions: ['analyze_text', 'generate_content', 'classify_data']

// Payment/Finance
providers: ['Stripe', 'PayPal', 'QuickBooks']
actions: ['process_payment', 'create_invoice', 'sync_transactions']
```

### **Integration Architecture**

#### **1. OAuth & Authentication Management**
```typescript
// Database schema extensions:
table WorkspaceIntegration {
  id: string
  workspaceId: string  
  provider: string      // 'slack', 'hubspot', 'google'
  authType: string      // 'oauth2', 'api_key', 'basic'
  credentials: encrypted_json
  scopes: string[]
  isActive: boolean
  lastUsed: datetime
  refreshToken?: encrypted_string
}

// OAuth flow:
1. User initiates integration setup
2. Redirect to provider OAuth
3. Store encrypted tokens  
4. Refresh tokens automatically
5. Revoke when needed
```

#### **2. Integration Service Layer**
```typescript
@Injectable()
export class IntegrationService {
  
  async executeIntegrationAction(
    workspaceId: string,
    provider: string,
    action: string,
    parameters: Record<string, any>
  ): Promise<IntegrationResult> {
    
    // 1. Get workspace integration config
    const integration = await this.getIntegration(workspaceId, provider);
    
    // 2. Refresh auth if needed
    await this.ensureValidAuth(integration);
    
    // 3. Execute action via provider-specific service
    const service = this.getProviderService(provider);
    return await service.executeAction(action, parameters, integration.credentials);
  }

  private getProviderService(provider: string): IntegrationProvider {
    switch (provider) {
      case 'slack': return this.slackService;
      case 'hubspot': return this.hubspotService;
      case 'google': return this.googleService;
      // ... etc
    }
  }
}
```

#### **3. Provider-Specific Services**
```typescript
// Example: SlackIntegrationService
@Injectable() 
export class SlackIntegrationService implements IntegrationProvider {
  
  async executeAction(action: string, params: any, auth: any): Promise<any> {
    const client = new WebClient(auth.botToken);
    
    switch (action) {
      case 'post_message':
        return await client.chat.postMessage({
          channel: params.channel,
          text: params.message,
          blocks: params.blocks
        });
        
      case 'create_channel':
        return await client.conversations.create({
          name: params.name,
          is_private: params.isPrivate
        });
    }
  }
}

// Example: HubSpotIntegrationService  
@Injectable()
export class HubSpotIntegrationService implements IntegrationProvider {
  
  async executeAction(action: string, params: any, auth: any): Promise<any> {
    const client = new hubspot.Client({ accessToken: auth.accessToken });
    
    switch (action) {
      case 'create_lead':
        return await client.crm.contacts.basicApi.create({
          properties: {
            email: params.email,
            firstname: params.firstName,
            lastname: params.lastName,
            company: params.company
          }
        });
    }
  }
}
```

### **Enhanced Action Execution**
```typescript
// Updated action-library.service.ts
private async handleAgentInstruction(parameters: any, context: ActionContext): Promise<ActionResult> {
  const { instruction } = parameters;
  
  // 1. Analyze instruction for integration needs
  const analysis = await this.analyzeInstructionIntegrations(instruction);
  
  // 2. Execute based on detected integrations
  if (analysis.requiresEmail) {
    return await this.integrationService.executeIntegrationAction(
      context.workspaceId, 
      'sendgrid', 
      'send_email',
      analysis.emailParams
    );
  }
  
  if (analysis.requiresSlack) {
    return await this.integrationService.executeIntegrationAction(
      context.workspaceId,
      'slack', 
      'post_message',
      analysis.slackParams
    );
  }
  
  // 3. Continue with intelligent multi-step execution...
}
```

---

## 🚧 **Implementation Roadmap**

### **Phase 1: Natural Language Workflows (2 weeks)**
- ✅ Create NaturalWorkflowModal component
- ✅ Build workflow analysis API endpoint
- ✅ Implement AI-powered step detection
- ✅ Generate executable workflows from descriptions

### **Phase 2: Essential Integrations (3 weeks)**  
- 🔧 Email service integration (SendGrid/AWS SES)
- 🔧 Slack API integration with OAuth
- 🔧 Google Calendar integration
- 🔧 Integration management UI

### **Phase 3: Business Integrations (4 weeks)**
- 🔧 HubSpot CRM integration
- 🔧 Google Docs/Office 365 integration  
- 🔧 Asana/Notion project management
- 🔧 Advanced workflow triggers

### **Phase 4: Advanced Features (2 weeks)**
- 🔧 Webhook handling system
- 🔧 Error handling & retry logic
- 🔧 Integration marketplace/templates
- 🔧 Analytics and monitoring

---

## 💡 **Example: End-to-End Natural Language Workflow**

### **User Input**
```
"When someone submits our contact form, send them a welcome email using our 
template, create a lead in HubSpot with their info, assign it to the sales 
team, and post a notification in our #leads Slack channel"
```

### **AI Analysis Output**
```typescript
{
  understanding: "Multi-step lead processing workflow with form trigger",
  trigger: {
    type: "webhook",
    source: "contact_form",
    events: ["form_submission"]
  },
  steps: [
    {
      action: "send_email",
      provider: "sendgrid", 
      parameters: {
        template: "welcome_template",
        recipient: "{{form.email}}",
        personalizations: ["{{form.name}}"]
      }
    },
    {
      action: "create_lead",
      provider: "hubspot",
      parameters: {
        email: "{{form.email}}",
        name: "{{form.name}}",
        company: "{{form.company}}",
        source: "website_form"
      }
    },
    {
      action: "post_message", 
      provider: "slack",
      parameters: {
        channel: "#leads",
        message: "New lead: {{form.name}} from {{form.company}}"
      }
    }
  ],
  requiredIntegrations: ["sendgrid", "hubspot", "slack"],
  estimatedSetupTime: "5 minutes"
}
```

### **Generated Workflow**
- ✅ Webhook endpoint created automatically
- ✅ Email template configured with variables  
- ✅ HubSpot field mapping established
- ✅ Slack notification formatted with lead data
- ✅ Error handling for each step
- ✅ Success/failure notifications

---

This approach transforms **"I want to automate X"** into **fully functional, real-world workflows** that actually accomplish business tasks through proper integrations! 🚀 
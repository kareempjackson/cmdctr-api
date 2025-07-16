# Agent Actions System

## Overview

The cmdctr system now supports automated agentic actions, allowing agents to perform real-world tasks like API calls, file operations, web scraping, and more. This enables agents to be truly autonomous and take actions on behalf of users.

## Features

### 1. Built-in Actions
- **HTTP Requests**: Make API calls to external services
- **File Operations**: Read, write, and list files
- **Web Scraping**: Extract content from web pages
- **System Commands**: Execute safe system commands
- **Database Queries**: Query workspace data
- **Communication**: Send emails and create notifications

### 2. Security & Safety
- **Permission-based**: Only agents with action capabilities can execute actions
- **Path Restrictions**: File operations limited to safe directories
- **Command Whitelist**: Only safe system commands allowed
- **Query Restrictions**: Database queries limited to SELECT operations
- **Rate Limiting**: Built-in protection against abuse

### 3. Action History & Monitoring
- **Complete Audit Trail**: All actions logged with metadata
- **Success/Failure Tracking**: Monitor action execution results
- **Performance Metrics**: Track execution times and resource usage
- **Error Handling**: Comprehensive error reporting and recovery

## Implementation

### Action Execution Flow

1. **User Input**: User sends a request to an agent
2. **Context Building**: Agent receives memory, knowledge, and available actions
3. **LLM Processing**: Agent decides whether to execute an action
4. **Action Execution**: If action is requested, it's executed securely
5. **Result Integration**: Action results are included in the response
6. **Memory Storage**: Complete interaction stored in agent memory

### Action Response Format

Agents can execute actions by responding with JSON:

```json
{
  "action": {
    "name": "http_request",
    "parameters": {
      "method": "GET",
      "url": "https://api.example.com/data"
    }
  }
}
```

## Available Actions

### HTTP Requests (`http_request`)
Make API calls to external services.

**Parameters:**
- `method` (string, required): HTTP method (GET, POST, PUT, DELETE)
- `url` (string, required): URL to make the request to
- `headers` (object, optional): Request headers
- `body` (object, optional): Request body

**Example:**
```json
{
  "action": {
    "name": "http_request",
    "parameters": {
      "method": "POST",
      "url": "https://api.example.com/users",
      "headers": {"Content-Type": "application/json"},
      "body": {"name": "John Doe", "email": "john@example.com"}
    }
  }
}
```

### File Operations

#### Read File (`read_file`)
Read content from a file.

**Parameters:**
- `path` (string, required): Path to the file
- `encoding` (string, optional): File encoding (default: utf8)

**Example:**
```json
{
  "action": {
    "name": "read_file",
    "parameters": {
      "path": "/uploads/data.json",
      "encoding": "utf8"
    }
  }
}
```

#### Write File (`write_file`)
Write content to a file.

**Parameters:**
- `path` (string, required): Path to the file
- `content` (string, required): Content to write
- `encoding` (string, optional): File encoding (default: utf8)

**Example:**
```json
{
  "action": {
    "name": "write_file",
    "parameters": {
      "path": "/uploads/report.txt",
      "content": "Analysis complete. Found 5 issues.",
      "encoding": "utf8"
    }
  }
}
```

#### List Files (`list_files`)
List files in a directory.

**Parameters:**
- `path` (string, required): Directory path
- `pattern` (string, optional): File pattern filter (e.g., "*.txt")

**Example:**
```json
{
  "action": {
    "name": "list_files",
    "parameters": {
      "path": "/uploads",
      "pattern": "*.json"
    }
  }
}
```

### Web Scraping (`web_scrape`)
Extract content from web pages.

**Parameters:**
- `url` (string, required): URL to scrape
- `selector` (string, optional): CSS selector for specific content

**Example:**
```json
{
  "action": {
    "name": "web_scrape",
    "parameters": {
      "url": "https://example.com",
      "selector": ".content"
    }
  }
}
```

### System Commands (`execute_command`)
Execute safe system commands.

**Parameters:**
- `command` (string, required): Command to execute
- `cwd` (string, optional): Working directory

**Allowed Commands:**
- `ls`, `cat`, `head`, `tail`, `grep`, `find`, `wc`, `sort`, `uniq`
- `npm`, `node`, `git`, `echo`, `pwd`, `whoami`, `date`

**Example:**
```json
{
  "action": {
    "name": "execute_command",
    "parameters": {
      "command": "ls -la /uploads",
      "cwd": "/app"
    }
  }
}
```

### Database Queries (`query_database`)
Query workspace data (SELECT only for security).

**Parameters:**
- `query` (string, required): SQL query (SELECT only)
- `params` (array, optional): Query parameters

**Example:**
```json
{
  "action": {
    "name": "query_database",
    "parameters": {
      "query": "SELECT COUNT(*) as count FROM agents WHERE workspaceId = ?",
      "params": ["workspace-123"]
    }
  }
}
```

### Communication Actions

#### Send Email (`send_email`)
Send an email (requires email service integration).

**Parameters:**
- `to` (string, required): Recipient email address
- `subject` (string, required): Email subject
- `body` (string, required): Email body
- `format` (string, optional): Email format (text/html)

**Example:**
```json
{
  "action": {
    "name": "send_email",
    "parameters": {
      "to": "user@example.com",
      "subject": "Analysis Complete",
      "body": "Your data analysis is ready.",
      "format": "html"
    }
  }
}
```

#### Create Notification (`create_notification`)
Create a notification in the workspace.

**Parameters:**
- `title` (string, required): Notification title
- `message` (string, required): Notification message
- `type` (string, optional): Type (info/warning/error/success)
- `userIds` (array, optional): User IDs to notify

**Example:**
```json
{
  "action": {
    "name": "create_notification",
    "parameters": {
      "title": "Task Complete",
      "message": "The analysis is finished",
      "type": "success",
      "userIds": ["user-123", "user-456"]
    }
  }
}
```

## API Endpoints

### Get Available Actions
```http
GET /actions
Authorization: Bearer <token>
```

### Execute Action
```http
POST /actions/execute
Authorization: Bearer <token>
Content-Type: application/json

{
  "actionName": "http_request",
  "parameters": {
    "method": "GET",
    "url": "https://api.example.com/data"
  },
  "agentId": "agent-123",
  "workspaceId": "workspace-456"
}
```

### Get Action History
```http
GET /actions/history/:agentId?page=1&pageSize=20
Authorization: Bearer <token>
```

## Configuration

### Agent Action Permissions

To enable actions for an agent, add the "actions" capability to the agent's config:

```json
{
  "capabilities": ["actions", "memory", "knowledge"],
  "systemPrompt": "You are an agent that can perform actions...",
  "model": "gpt-4-1106-preview"
}
```

### Security Settings

**Allowed File Paths:**
- `/app/uploads` - User uploads
- `/app/data` - Application data
- Current working directory (read-only)

**Allowed Commands:**
- File operations: `ls`, `cat`, `head`, `tail`, `grep`, `find`, `wc`, `sort`, `uniq`
- Development: `npm`, `node`, `git`
- System info: `echo`, `pwd`, `whoami`, `date`

**Database Restrictions:**
- Only SELECT queries allowed
- No DDL or DML operations
- Parameterized queries for security

## Monitoring & Analytics

### Action Metrics
- **Execution Count**: Number of actions executed per agent
- **Success Rate**: Percentage of successful actions
- **Average Duration**: Mean execution time per action type
- **Error Analysis**: Common failure patterns and causes

### Audit Trail
All actions are logged with:
- Agent ID and user ID
- Action name and parameters
- Execution time and result
- Error details if failed
- Timestamp and metadata

### Performance Monitoring
- Real-time action execution monitoring
- Resource usage tracking
- Rate limiting and abuse prevention
- Alert system for failed actions

## Best Practices

### 1. Action Design
- **Clear Parameters**: Use descriptive parameter names
- **Validation**: Validate all input parameters
- **Error Handling**: Provide meaningful error messages
- **Documentation**: Document each action thoroughly

### 2. Security
- **Principle of Least Privilege**: Only grant necessary permissions
- **Input Validation**: Validate all user inputs
- **Output Sanitization**: Sanitize action outputs
- **Rate Limiting**: Prevent abuse through rate limiting

### 3. Monitoring
- **Log Everything**: Log all action executions
- **Monitor Performance**: Track execution times
- **Alert on Failures**: Set up alerts for failed actions
- **Regular Audits**: Review action history regularly

## Future Enhancements

### 1. Custom Actions
- **Action Builder**: Visual action creation interface
- **Custom Scripts**: Support for custom JavaScript/Python scripts
- **Action Templates**: Reusable action templates
- **Action Marketplace**: Community-shared actions

### 2. Advanced Features
- **Action Chaining**: Execute multiple actions in sequence
- **Conditional Actions**: Execute actions based on conditions
- **Scheduled Actions**: Schedule actions for later execution
- **Action Dependencies**: Define action dependencies

### 3. Integration
- **Webhook Support**: Trigger actions via webhooks
- **Third-party APIs**: More API integrations
- **Cloud Services**: AWS, GCP, Azure integrations
- **Database Support**: More database types

## Troubleshooting

### Common Issues

1. **Action Not Found**
   - Check if action name is correct
   - Verify agent has action permissions
   - Check action is properly registered

2. **Permission Denied**
   - Verify file paths are within allowed directories
   - Check command is in allowed list
   - Ensure agent has necessary permissions

3. **Action Failed**
   - Check error logs for details
   - Verify input parameters
   - Test action manually

### Debug Commands
```bash
# Check action history
curl -X GET "http://localhost:3000/actions/history/agent-id"

# Test action execution
curl -X POST "http://localhost:3000/actions/execute" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"actionName": "list_files", "parameters": {"path": "/uploads"}, "agentId": "agent-id", "workspaceId": "workspace-id"}'
```

## Examples

### Data Analysis Agent
```json
{
  "action": {
    "name": "http_request",
    "parameters": {
      "method": "GET",
      "url": "https://api.analytics.com/data",
      "headers": {"Authorization": "Bearer <token>"}
    }
  }
}
```

### File Processing Agent
```json
{
  "action": {
    "name": "read_file",
    "parameters": {
      "path": "/uploads/dataset.csv"
    }
  }
}
```

### Notification Agent
```json
{
  "action": {
    "name": "create_notification",
    "parameters": {
      "title": "Analysis Complete",
      "message": "Your data analysis is ready for review",
      "type": "success"
    }
  }
}
``` 
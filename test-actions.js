const axios = require('axios');

async function testAgentActions() {
  console.log('🧪 Testing Agent Actions System...\n');

  const baseURL = 'http://localhost:3000';
  const token = process.env.TEST_TOKEN || 'your-test-token-here';
  const agentId = process.env.TEST_AGENT_ID || 'test-agent-123';
  const workspaceId = process.env.TEST_WORKSPACE_ID || 'test-workspace-456';

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  try {
    // 1. Test getting available actions
    console.log('1. Testing get available actions...');
    const actionsResponse = await axios.get(`${baseURL}/actions`, { headers });
    console.log(`   Found ${actionsResponse.data.length} available actions`);
    actionsResponse.data.forEach(action => {
      console.log(`   - ${action.name}: ${action.description}`);
    });
    console.log('');

    // 2. Test action execution (list files)
    console.log('2. Testing action execution (list_files)...');
    const executeResponse = await axios.post(`${baseURL}/actions/execute`, {
      actionName: 'list_files',
      parameters: {
        path: '/app/uploads'
      },
      agentId,
      workspaceId
    }, { headers });

    console.log(`   Action executed: ${executeResponse.data.success}`);
    if (executeResponse.data.success) {
      console.log(`   Result: ${JSON.stringify(executeResponse.data.data, null, 2)}`);
    } else {
      console.log(`   Error: ${executeResponse.data.error}`);
    }
    console.log('');

    // 3. Test action history
    console.log('3. Testing action history...');
    const historyResponse = await axios.get(`${baseURL}/actions/history/${agentId}`, { headers });
    console.log(`   Found ${historyResponse.data.length} action history entries`);
    historyResponse.data.forEach(entry => {
      console.log(`   - ${entry.actionName}: ${entry.success ? 'SUCCESS' : 'FAILED'} (${entry.executionTime}ms)`);
    });
    console.log('');

    // 4. Test agent execution with action capability
    console.log('4. Testing agent execution with action capability...');
    const agentResponse = await axios.post(`${baseURL}/agents/${agentId}/execute`, {
      input: 'List the files in the uploads directory and create a summary',
      metadata: { test: true }
    }, { headers });

    console.log(`   Agent response: ${agentResponse.data.output.substring(0, 200)}...`);
    if (agentResponse.data.actionResult) {
      console.log(`   Action executed: ${agentResponse.data.actionResult.success ? 'SUCCESS' : 'FAILED'}`);
    }
    console.log('');

    console.log('✅ All action tests completed successfully!');

  } catch (error) {
    console.error('❌ Error during action testing:', error.response?.data || error.message);
    console.error(error.stack);
  }
}

// Run the test
testAgentActions().catch(console.error); 
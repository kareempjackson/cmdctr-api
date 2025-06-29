const { WeaviateService } = require('./src/vector/weaviate.service');
const { OpenaiService } = require('./src/openai/openai.service');
const { ConfigService } = require('./src/config/config.service');

async function testMemorySummarization() {
  console.log('🧪 Testing Memory Summarization and Smart Selection...\n');

  // Initialize services
  const config = new ConfigService();
  const openai = new OpenaiService(config);
  const weaviate = new WeaviateService(openai);

  // Test agent ID (replace with a real one from your system)
  const testAgentId = 'test-agent-123';
  const testQuery = 'What have we discussed about project planning?';

  try {
    console.log('1. Testing getAllMemories...');
    const allMemories = await weaviate.getAllMemories(testAgentId);
    console.log(`   Found ${allMemories.length} total memories\n`);

    if (allMemories.length > 0) {
      console.log('2. Testing generateMemorySummary...');
      const summary = await weaviate.generateMemorySummary(testAgentId);
      console.log(`   Summary (${summary.length} chars): ${summary.slice(0, 200)}...\n`);

      console.log('3. Testing buildComprehensiveMemoryContext...');
      const memoryContext = await weaviate.buildComprehensiveMemoryContext(testAgentId, testQuery);
      console.log(`   Memory Context (${memoryContext.length} chars): ${memoryContext.slice(0, 300)}...\n`);

      console.log('4. Testing semantic search...');
      const queryEmbedding = await openai.generateEmbedding(testQuery);
      const semanticResults = await weaviate.searchMemory(testAgentId, queryEmbedding, 3);
      console.log(`   Semantic search returned ${semanticResults.length} results\n`);

      console.log('✅ All memory tests completed successfully!');
    } else {
      console.log('⚠️  No memories found for test agent. Create some memories first to test the functionality.');
    }

  } catch (error) {
    console.error('❌ Error during memory testing:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testMemorySummarization().catch(console.error); 
# Memory Management System

## Overview

The cmdctr system now includes advanced memory management capabilities that ensure all agent and user memories are effectively utilized in LLM interactions while maintaining token efficiency.

## Features

### 1. Memory Summarization
- **Automatic Summarization**: Generates concise summaries of conversation history using GPT-3.5-turbo
- **Smart Filtering**: Excludes training file memories and focuses on actual conversations
- **Fallback Strategy**: Uses recent memory concatenation if summarization fails

### 2. Smart Memory Selection
- **Hybrid Approach**: Combines summary, recent, and semantic memories
- **Adaptive Strategy**: 
  - ≤10 memories: Use all memories
  - >10 memories: Summary + Recent (5) + Semantic (5)
- **Duplicate Prevention**: Avoids including the same memory multiple times

### 3. Comprehensive Memory Context
- **Token-Efficient**: Provides maximum memory coverage within token limits
- **Query-Aware**: Uses semantic search to find relevant historical interactions
- **Structured Output**: Formats memory context for optimal LLM consumption

## Implementation

### Core Methods

#### `getAllMemories(agentId: string)`
Retrieves all memories for an agent from Weaviate.

#### `generateMemorySummary(agentId: string)`
Creates a 2-3 paragraph summary of conversation history using GPT-3.5-turbo.

#### `buildComprehensiveMemoryContext(agentId: string, query: string)`
Builds optimal memory context using the hybrid strategy.

### Usage in Services

#### Agent Execution (`agents.service.ts`)
```typescript
// Old approach: Only semantic search
const relevantMemories = await this.weaviate.searchMemory(agentId, inputEmbedding, 5);

// New approach: Comprehensive context
const memoryContext = await this.weaviate.buildComprehensiveMemoryContext(agentId, dto.input);
```

#### Canvas Generation (`prompt.service.ts`)
```typescript
// Include user memory context in canvas generation
const memoryContext = await this.knowledgeService.weaviateService.buildComprehensiveMemoryContext(userId, prompt);
```

## API Endpoints

### Memory Management
- `POST /agents/:id/memory/summarize` - Generate memory summary
- `GET /agents/:id/memory/context?query=...` - Get comprehensive memory context
- `POST /agents/:id/memory/search` - Search memories semantically

## Configuration

### Memory Strategy Parameters
- **Recent Memory Count**: 5 (configurable)
- **Semantic Search Limit**: 5 (configurable)
- **Summary Token Limit**: 400 (configurable)
- **Memory Threshold**: 10 (use all vs. hybrid strategy)

### OpenAI Models
- **Summary Generation**: `gpt-3.5-turbo`
- **Embedding**: `text-embedding-ada-002`
- **Main LLM**: `gpt-4-1106-preview`

## Benefits

### 1. Complete Memory Utilization
- All memories are considered in every interaction
- No important context is lost due to token limits

### 2. Improved Context Quality
- Summary provides high-level understanding
- Recent memories maintain conversation continuity
- Semantic search finds relevant historical context

### 3. Token Efficiency
- Summaries compress information without losing key insights
- Smart selection prevents token waste on irrelevant memories
- Structured format optimizes LLM processing

### 4. Scalability
- Hybrid strategy scales to large memory sets
- Automatic adaptation based on memory count
- Efficient processing for both small and large agents

## Testing

Run the memory test script:
```bash
node test-memory.js
```

This will test:
1. Memory retrieval
2. Summary generation
3. Context building
4. Semantic search

## Monitoring

### Logging
The system provides detailed logging for memory operations:
- Memory count and context length
- Summary generation success/failure
- Semantic search results
- Token usage statistics

### Metrics
Track memory effectiveness through:
- Context length in LLM calls
- Memory utilization rates
- Summary quality metrics
- Response relevance scores

## Future Enhancements

### 1. Memory Compression
- Implement LangChain memory compression components
- Add hierarchical memory tiers
- Support memory pruning strategies

### 2. Adaptive Selection
- Dynamic memory selection based on query type
- Context-aware memory prioritization
- Learning-based memory importance scoring

### 3. Memory Analytics
- Memory usage patterns analysis
- Effectiveness metrics dashboard
- Memory optimization recommendations

## Troubleshooting

### Common Issues

1. **No Memories Found**
   - Check if agent has interaction history
   - Verify Weaviate connection
   - Ensure memory storage is working

2. **Summary Generation Fails**
   - Check OpenAI API key and quota
   - Verify network connectivity
   - Review error logs for details

3. **High Token Usage**
   - Adjust memory thresholds
   - Reduce summary token limit
   - Implement memory pruning

### Debug Commands
```bash
# Test memory retrieval
curl -X GET "http://localhost:3000/agents/{agentId}/memory/context?query=test"

# Generate memory summary
curl -X POST "http://localhost:3000/agents/{agentId}/memory/summarize"

# Search memories
curl -X POST "http://localhost:3000/agents/{agentId}/memory/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "test query", "limit": 5}'
``` 
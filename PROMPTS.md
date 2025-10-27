# AI Prompts Used in Development

This document records the key AI prompts and interactions used during the development of EdgeSec Copilot.

## System Prompts

### Main Agent System Prompt (`worker/src/agent.ts`)

```
You are an expert Cloudflare security assistant with deep knowledge of WAF rules, DDoS mitigation, and web application security.

IMPORTANT: You are an ADVISORY TOOL ONLY. You CANNOT directly apply or rollback rules. You can only:
1. Analyze traffic and identify threats
2. Recommend WAF rules with clear explanations
3. Simulate what would happen if rules were applied
4. Query similar past incidents from the knowledge base

Your role is to provide expert guidance and recommendations. Users must manually implement any suggested rules in their Cloudflare dashboard.

When users upload logs, analyze them thoroughly for:
- SQL injection attempts
- XSS attacks
- DDoS patterns
- Suspicious user agents
- Rate limit violations
- Geographic anomalies

Always:
- Use the query_similar_incidents tool to find relevant documentation
- Provide specific WAF rule configurations with exact field paths
- Explain the reasoning behind each recommendation
- Include simulation results when proposing rules
- Be precise with Cloudflare expression syntax

Available tools:
- analyze_traffic: Analyze uploaded security logs
- propose_waf_rule: Recommend specific WAF rules
- simulate_rule: Show potential impact of proposed rules
- query_similar_incidents: Search past incidents and documentation

Remember: You provide expert advice, but users control all rule deployments.
```

### Embedding Generation Context

When generating embeddings for the knowledge base, the following chunking strategy was used:

```python
# Chunk size: 500 characters
# Overlap: 50 characters
# Model: @cf/baai/bge-base-en-v1.5 (768 dimensions)
# Distance metric: cosine similarity
```

Documents embedded:
1. `cloudflare_waf_rules.md` - Cloudflare WAF configuration guide
2. `sql_injection_response.md` - SQL injection mitigation playbook
3. `ddos_mitigation.md` - DDoS response procedures
4. Additional security documentation and runbooks

## Development Prompts (github copilot)

### Feature Implementation Prompts

#### Conversation Persistence

**User Request:**
> "I would like fix and confirm that when user uploads logs, we need to save logs in a storage and not just run analyze directly from user message"

**Solution:**
- Integrated Durable Objects (`SecurityStateDO`)
- Added `addConversationTurn()` and `getConversationHistory()` methods
- Modified frontend to display conversation history with tabs
- Implemented auto-refresh every 5 seconds

#### RAG Integration

**User Request:**
> "Vectorize is empty, we haven't uploaded any embeddings yet"

**Solution:**
- Created `python/embedding_gen.py` to chunk documents
- Created `python/upload_embeddings.py` to upload via worker endpoint
- Added `/admin/populate-embeddings` endpoint in `worker/src/index.ts`
- Successfully uploaded 5 document chunks


### Debugging Prompts

#### Worker Reload Loop Issue

**Problem:**
> "Worker keeps restarting every second"

**Solution:**
- Identified file watch causing reload loop
- Cleared build cache: `rm -rf .wrangler node_modules/.cache`
- Restarted worker in clean state
- Issue resolved

#### JSX Syntax Errors

**Problem:**
> "Missing closing tags in RuleHistory.tsx with tab switching"

**Solution:**
- Fixed unclosed `<>` fragments
- Properly structured conditional rendering
- Added closing tags for all JSX elements
- Verified with TypeScript compiler

### UI/UX Prompts

#### Markdown Rendering Improvements

**User Request:**
> "The markdown rendering looks cramped, need better spacing"

**Solution:**
- Added Tailwind typography classes: `prose prose-invert`
- Custom spacing: `my-4` for paragraphs, `mt-8` for headings
- List spacing: `space-y-2`, `ml-6` indentation
- Improved line-height: `leading-7` for readability

### Code Quality Prompts


#### Type Safety

Throughout development, maintained strict TypeScript usage:
- Defined interfaces for all data structures (`ConversationTurn`, `Recommendation`, `LogEntry`)
- Used proper typing for Cloudflare bindings (`Env` interface)
- Enabled strict mode in `tsconfig.json`

## RAG Query Examples

### Effective Queries

**User Question:**
> "What are best practices for SQL injection prevention?"

**RAG Query Generated:**
```
SQL injection prevention WAF rules Cloudflare
```

**Context Retrieved:**
- `sql_injection_response.md` (similarity: 0.89)
- `cloudflare_waf_rules.md` section on expression rules (similarity: 0.82)

### Tool Usage Patterns

#### Analyze Traffic Tool

**Typical Invocation:**
```json
{
  "name": "analyze_traffic",
  "parameters": {
    "logs": [...],
    "context": "User uploaded 150 log entries for threat analysis"
  }
}
```

#### Propose WAF Rule Tool

**Typical Invocation:**
```json
{
  "name": "propose_waf_rule",
  "parameters": {
    "rule_description": "Block SQL injection attempts in query parameters",
    "expression": "(http.request.uri.query contains \"UNION\" or http.request.uri.query contains \"SELECT\")",
    "action": "block",
    "rationale": "Detected 15 SQL injection attempts in recent logs"
  }
}
```


All prompts were designed to leverage these technologies while maintaining type safety, code quality, and user experience.

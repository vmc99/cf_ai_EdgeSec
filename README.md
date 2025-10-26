# EdgeSec Copilot

AI-powered security assistant for Cloudflare that analyzes traffic, detects threats, and recommends WAF rules using AI and RAG.

## Overview

EdgeSec Copilot helps security teams by:
- Answering questions about web security and WAF rules
- Analyzing security logs to identify threats (SQL injection, XSS, DDoS)
- Recommending specific WAF rules with explanations
- Running simulations to show potential impact
- Maintaining conversation history for context

**Important**: This is an advisory tool only. It does NOT automatically apply rules. All recommendations must be manually implemented in your Cloudflare dashboard.

## Architecture

```
React UI (Pages) → Worker (Agent) → Workers AI (Llama 3.3)
                        ↓
        Durable Objects + Vectorize + KV
```

**Components:**
- **Frontend**: React + TypeScript on Cloudflare Pages
- **Backend**: Cloudflare Workers with Agents SDK
- **LLM**: Workers AI (@cf/meta/llama-3.3-70b-instruct-fp8-fast)
- **Memory**: Durable Objects (conversation history)
- **RAG**: Vectorize (embedded documentation)
- **Storage**: KV (summaries)

## Features

- Chat interface for security questions
- Log upload and analysis
- WAF rule recommendations
- Conversation history
- RAG-powered answers from Cloudflare documentation

## Project Structure

```
cf_ai_EdgeSec/
├── app/                  # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatInterface.tsx
│   │   │   ├── LogUpload.tsx
│   │   │   ├── History.tsx
│   │   │   └── Header.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
│
├── worker/               # Cloudflare Worker
│   ├── src/
│   │   ├── index.ts     # Main API routes
│   │   ├── agent.ts     # AI agent configuration
│   │   ├── rag.ts       # RAG implementation
│   │   ├── tools/       # Agent tools
│   │   └── durable-objects/
│   │       └── security-state.ts
│   └── wrangler.toml
│
├── data/                 # RAG knowledge base
│   ├── docs/            # Documentation
│   ├── runbooks/        # Security runbooks
│   └── embeddings.jsonl # Pre-computed vectors
│
└── python/              # Embedding tools
    ├── embedding_gen.py
    └── upload_embeddings.py
```

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.8+ (for embeddings)
- Cloudflare account with Workers AI enabled

### Setup

1. **Clone and install dependencies**

```bash
# Install worker dependencies
cd worker
npm install

# Install frontend dependencies
cd ../app
npm install

# Install Python dependencies (optional, for embedding generation)
cd ../python
pip install -r requirements.txt
```

2. **Configure Cloudflare**

Update `worker/wrangler.toml` with your account details:

```toml
name = "edgesec-copilot"
account_id = "your-account-id"

[[vectorize]]
binding = "VECTORIZE"
index_name = "edgesec-security-docs"
```

3. **Create Vectorize index**

```bash
cd worker
npx wrangler vectorize create edgesec-security-docs \
  --dimensions=768 \
  --metric=cosine
```

4. **Upload embeddings to Vectorize**

```bash
cd python
python upload_embeddings.py
```

### Development

**Start the worker (backend):**

```bash
cd worker
npm run dev
# Worker runs at http://localhost:8787
```

**Start the frontend:**

```bash
cd app
npm run dev
# Frontend runs at http://localhost:3001
```

### Deployment

**Deploy worker:**

```bash
cd worker
npm run deploy
```

**Deploy frontend:**

```bash
cd app
npm run build
npx wrangler pages deploy dist
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/chat` | POST | Send message to AI agent |
| `/logs/upload` | POST | Upload and analyze logs |
| `/recommendations/history` | GET | Get conversation history |
| `/admin/populate-embeddings` | POST | Upload embeddings to Vectorize |

## RAG Knowledge Base

The system uses Retrieval-Augmented Generation (RAG) to provide accurate answers based on documentation.

### How RAG Works

1. User asks a question
2. System generates embedding of the question (768 dimensions)
3. Searches Vectorize for similar documentation
4. Retrieves top 3 relevant document chunks
5. Injects context into LLM prompt
6. LLM generates answer with citations

### Current Knowledge Base

Located in `data/`:
- `docs/cloudflare_waf_rules.md` - WAF syntax and best practices
- `runbooks/sql_injection_response.md` - SQL injection mitigation
- `runbooks/ddos_mitigation.md` - DDoS response procedures

Total: 3 documents, 5 chunks embedded

### Adding New Documentation

1. Add markdown files to `data/docs/` or `data/runbooks/`

```bash
echo "# New Security Guide..." > data/docs/new_guide.md
```

2. Generate embeddings

```bash
cd python
python embedding_gen.py
```

3. Upload to Vectorize

```bash
python upload_embeddings.py
```

## Configuration

### Environment Variables

Worker (`worker/wrangler.toml`):
```toml
[env.production]
AI = { binding = "AI" }
VECTORIZE = { binding = "VECTORIZE", index_name = "edgesec-security-docs" }
SECURITY_STATE = { binding = "SECURITY_STATE", class_name = "SecurityStateDO" }
```

Frontend (`app/.env`):
```
VITE_WORKER_URL=http://localhost:8787
```

## Usage Examples

### Chat with AI

```typescript
const response = await fetch('http://localhost:8787/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'How do I block SQL injection attacks?',
    sessionId: 'session_123',
    accountId: 'demo_account'
  })
});
```

### Upload Logs

```typescript
const response = await fetch('http://localhost:8787/logs/upload', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    logs: [
      {
        clientIP: '192.168.1.1',
        path: '/api/users',
        method: 'GET',
        statusCode: 200,
        userAgent: 'Mozilla/5.0...'
      }
    ],
    sessionId: 'session_123'
  })
});
```

## Development Notes

### Adding Tools

Tools are defined in `worker/src/tools/`. Each tool:
- Implements a specific function (analyze traffic, propose rules)
- Has a JSON schema for parameters
- Returns structured data

Example tool structure:
```typescript
export const myTool = {
  name: 'my_tool',
  description: 'Does something useful',
  parameters: {
    type: 'object',
    properties: {
      input: { type: 'string' }
    }
  },
  function: async (args, env) => {
    // Tool implementation
    return { result: 'success' };
  }
};
```

### Modifying RAG Context

Edit `worker/src/rag.ts` to adjust:
- `topK`: Number of results (default: 3)
- Similarity threshold (default: 0.7)
- Embedding model (default: @cf/baai/bge-base-en-v1.5)

### Conversation Memory

Durable Objects store conversation history per session:
- Maximum 50 turns per session
- Automatically persists across requests
- Survives worker restarts

## Troubleshooting

### Worker not starting

```bash
# Check Wrangler version
npx wrangler --version

# Update if needed
npm install -g wrangler@latest
```

### Vectorize not populated

```bash
# Check if index exists
npx wrangler vectorize list

# Recreate if needed
npx wrangler vectorize create edgesec-security-docs \
  --dimensions=768 \
  --metric=cosine
```

### Frontend not connecting to worker

Check `app/.env`:
```
VITE_WORKER_URL=http://localhost:8787
```

Verify worker is running:
```bash
curl http://localhost:8787/health
```

## Tech Stack Details

### Frontend
- React 18 with TypeScript
- Vite 5 for build tooling
- Tailwind CSS for styling
- React Markdown for message rendering

### Backend
- Cloudflare Workers
- Workers AI (Llama 3.3 70B)
- Durable Objects for state
- Vectorize for RAG
- KV for caching

### AI Models
- LLM: @cf/meta/llama-3.3-70b-instruct-fp8-fast
- Embeddings: @cf/baai/bge-base-en-v1.5 (768 dimensions)

## Future Enhancements

- Recommendations Tab: Display structured WAF rule proposals with status tracking (pending, simulated, applied, rejected), risk levels, and simulation results for better visibility into proposed security changes
- Direct rule application to Cloudflare (currently advisory only)
- Staged rollout workflows (canary deployments)
- Real-time monitoring integration
- Advanced threat detection models
- Multi-zone support

## Security Considerations

- This tool provides recommendations only
- All WAF rules must be manually reviewed and applied
- Test rules in log mode before blocking
- Monitor for false positives
- Follow your organization's change management process

## License

MIT License - See LICENSE file for details


## Acknowledgments

Built with:
- Cloudflare Workers AI
- Cloudflare Vectorize
- Cloudflare Durable Objects
- React and TypeScript

import { WorkerEntrypoint } from 'cloudflare:workers';
import { createAgent } from './agent.js';
import { SecurityStateDO } from './durable-objects/security-state';
import { SecurityRolloutWorkflow } from '../../workflows/rollout';

interface Env {
  AI: any;
  VECTORIZE: VectorizeIndex;
  SECURITY_STATE: DurableObjectNamespace;
  SUMMARIES: KVNamespace;
  LOGS: R2Bucket;
  AUDIT_DB: D1Database;
  ANALYTICS: AnalyticsEngineDataset;
  ROLLOUT_WORKFLOW: Workflow;
  CF_API_TOKEN: string;
  CF_ZONE_ID: string;
  ENVIRONMENT: string;
  LOG_LEVEL: string;
  MAX_CONVERSATION_HISTORY: string;
}

export { SecurityStateDO, SecurityRolloutWorkflow };

export default class EdgeSecWorker extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Route handling
      switch (true) {
        case url.pathname === '/' && request.method === 'GET':
          return new Response(
            JSON.stringify({
              name: 'EdgeSec Copilot API',
              version: '0.1.0',
              status: 'online',
              endpoints: {
                health: 'GET /health',
                chat: 'POST /chat',
                uploadLogs: 'POST /logs/upload',
                recommendationsHistory: 'GET /recommendations/history',
                metrics: 'GET /metrics',
              },
              message: 'EdgeSec Copilot - AI-powered security advisor for Cloudflare',
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );

        case url.pathname === '/chat' && request.method === 'POST':
          return await this.handleChat(request);

        case url.pathname === '/logs/upload' && request.method === 'POST':
          return await this.handleLogUpload(request);

        case url.pathname === '/recommendations/history' && request.method === 'GET':
          return await this.handleRecommendationsHistory(request);

        case url.pathname === '/metrics' && request.method === 'GET':
          return await this.handleMetrics(request);

        case url.pathname === '/health' && request.method === 'GET':
          return new Response(JSON.stringify({ status: 'healthy', timestamp: Date.now() }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });

        case url.pathname === '/admin/populate-embeddings' && request.method === 'POST':
          return await this.handlePopulateEmbeddings(request);

        default:
          return new Response('Not Found', { status: 404, headers: corsHeaders });
      }
    } catch (error: any) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  private async handleChat(request: Request): Promise<Response> {
    const { message, sessionId, accountId, history } = await request.json() as {
      message: string;
      sessionId?: string;
      accountId?: string;
      history?: Array<{ role: string; content: string }>;
    };

    if (!message || !sessionId) {
      return new Response(JSON.stringify({ error: 'Missing message or sessionId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get Durable Object stub for session (use sessionId for consistency)
    const doId = this.env.SECURITY_STATE.idFromName(sessionId);
    const doStub = this.env.SECURITY_STATE.get(doId) as any;

    // Create agent with context
    const agent = await createAgent(this.env, doStub);

    // Run agent (augment with RAG + conversation history)
    const response = await (agent as any).run(message, {
      sessionId,
      accountId,
      history,
    });

    // Track analytics
    this.env.ANALYTICS.writeDataPoint({
      blobs: [sessionId, 'chat'],
      doubles: [1],
      indexes: [accountId || 'anonymous'],
    });

    return new Response(JSON.stringify(response), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  private async handleLogUpload(request: Request): Promise<Response> {
    const { logs, sessionId, metadata } = await request.json() as {
      logs: any[];
      sessionId?: string;
      metadata?: any;
    };

    if (!logs || !Array.isArray(logs)) {
      return new Response(JSON.stringify({ error: 'Invalid logs format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Store logs in R2
    const logId = `${sessionId || 'anonymous'}_${Date.now()}.json`;
    await this.env.LOGS.put(
      logId,
      JSON.stringify({ logs, metadata, uploadedAt: new Date().toISOString() })
    );

    // Trigger initial analysis
    const doId = this.env.SECURITY_STATE.idFromName(sessionId || 'anonymous');
    const doStub = this.env.SECURITY_STATE.get(doId) as any;
    
    const analysis = await doStub.analyzeTraffic(logs);

    return new Response(JSON.stringify({ logId, analysis }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  private async handleRecommendationsHistory(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Missing sessionId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const doId = this.env.SECURITY_STATE.idFromName(sessionId);
    const doStub = this.env.SECURITY_STATE.get(doId) as any;
    
    // Get both recommendations and conversation history
    const [recommendations, conversation] = await Promise.all([
      doStub.getRecommendationHistory(),
      doStub.getConversationHistory(50),
    ]);

    return new Response(JSON.stringify({ 
      recommendations: recommendations || [],
      conversation: conversation || [],
      sessionId,
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  private async handleMetrics(request: Request): Promise<Response> {
    // TODO: Query Analytics Engine for metrics
    const metrics = {
      totalConversations: 0,
      rulesProposed: 0,
      rulesApplied: 0,
      avgTimeToProposal: 0,
      falsePositiveRate: 0,
    };

    return new Response(JSON.stringify(metrics), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  private async handlePopulateEmbeddings(request: Request): Promise<Response> {
    try {
      const { documents } = await request.json() as {
        documents: Array<{ id: string; text: string; metadata: any }>;
      };

      if (!documents || !Array.isArray(documents)) {
        return new Response(JSON.stringify({ error: 'Invalid documents array' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      console.log(`Generating embeddings for ${documents.length} documents...`);

      // Generate embeddings using Workers AI
      const vectors = [];
      for (const doc of documents) {
        try {
          const embedding = await this.env.AI.run('@cf/baai/bge-base-en-v1.5', {
            text: doc.text.substring(0, 2000), // Truncate to avoid token limits
          });

          vectors.push({
            id: doc.id,
            values: embedding.data[0],
            metadata: doc.metadata || {},
          });
        } catch (error: any) {
          console.error(`Failed to generate embedding for ${doc.id}:`, error.message);
        }
      }

      console.log(`Generated ${vectors.length} embeddings, uploading to Vectorize...`);

      // Upload to Vectorize in batches
      const batchSize = 100;
      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize);
        await this.env.VECTORIZE.insert(batch);
      }

      return new Response(
        JSON.stringify({
          success: true,
          processed: documents.length,
          uploaded: vectors.length,
          message: `Successfully uploaded ${vectors.length} embeddings to Vectorize`,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    } catch (error: any) {
      console.error('Error populating embeddings:', error);
      return new Response(
        JSON.stringify({
          error: 'Failed to populate embeddings',
          message: error.message,
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
  }
}

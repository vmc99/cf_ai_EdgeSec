/**
 * Query Similar Incidents Tool
 * RAG search over past incidents and documentation
 */

export const querySimilarIncidentsTool = {
  name: 'query_similar_incidents',
  description: 'Search past incidents and Cloudflare documentation for relevant context and best practices.',
  
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query (e.g., "SQL injection mitigation", "DDoS from ASN 12345")',
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 10,
        default: 5,
        description: 'Maximum number of results to return',
      },
      sources: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['incidents', 'docs', 'runbooks'],
        },
        default: ['incidents', 'docs'],
        description: 'Sources to search',
      },
    },
    required: ['query'],
  },

  async execute(params: any, context: any): Promise<any> {
    const { query, limit = 5, sources = ['incidents', 'docs'] } = params;
    const { env, doStub } = context;

    const results: any = {
      query,
      incidents: [],
      documentation: [],
      runbooks: [],
    };

    try {
      // Search incidents from DO history
      if (sources.includes('incidents')) {
        const pastIncidents = await doStub.searchIncidents(query, limit);
        results.incidents = pastIncidents.map((incident: any) => ({
          timestamp: new Date(incident.timestamp).toISOString(),
          type: incident.anomalies?.[0]?.type || 'unknown',
          severity: incident.severity,
          mitigationApplied: incident.ruleApplied || null,
          outcome: incident.outcome || 'unknown',
          summary: incident.summary || 'No summary available',
        }));
      }

      // Search Vectorize for documentation
      if (sources.includes('docs') || sources.includes('runbooks')) {
        const vectorResults = await searchVectorize(
          env.VECTORIZE,
          env.AI,
          query,
          limit
        );

        vectorResults.forEach((result: any) => {
          if (result.metadata?.type === 'doc') {
            results.documentation.push({
              title: result.metadata.title,
              url: result.metadata.url,
              content: result.text,
              relevance: result.score,
            });
          } else if (result.metadata?.type === 'runbook') {
            results.runbooks.push({
              title: result.metadata.title,
              steps: result.metadata.steps,
              content: result.text,
              relevance: result.score,
            });
          }
        });
      }

      // Get summary from KV cache if available
      const cacheKey = `similar_${hashQuery(query)}`;
      const cached = await env.SUMMARIES?.get(cacheKey);
      
      if (cached) {
        results.summary = cached;
      } else {
        // Generate summary using AI
        const summary = await generateIncidentSummary(
          env.AI,
          results.incidents,
          results.documentation
        );
        results.summary = summary;
        
        // Cache for 1 hour
        await env.SUMMARIES?.put(cacheKey, summary, { expirationTtl: 3600 });
      }

      return {
        success: true,
        totalFound: results.incidents.length + results.documentation.length + results.runbooks.length,
        results,
        insights: generateInsights(results),
      };

    } catch (error: any) {
      return {
        error: `Search failed: ${error.message}`,
        query,
      };
    }
  },
};

async function searchVectorize(
  vectorize: any,
  ai: any,
  query: string,
  limit: number
): Promise<any[]> {
  try {
    // Generate embedding for query
    const embedding = await ai.run('@cf/baai/bge-base-en-v1.5', {
      text: [query],
    });

    if (!embedding || !embedding.data || !embedding.data[0]) {
      return [];
    }

    // Search Vectorize index
    const results = await vectorize.query(embedding.data[0], {
      topK: limit,
      returnMetadata: true,
    });

    return results.matches || [];

  } catch (error) {
    console.error('Vectorize search error:', error);
    return [];
  }
}

async function generateIncidentSummary(
  ai: any,
  incidents: any[],
  docs: any[]
): Promise<string> {
  if (incidents.length === 0 && docs.length === 0) {
    return 'No relevant past incidents or documentation found.';
  }

  const prompt = `Based on the following past incidents and documentation, provide a concise summary of common patterns and recommended mitigation strategies:

PAST INCIDENTS:
${incidents.map(i => `- ${i.type} (${i.severity}): ${i.summary}`).join('\n')}

DOCUMENTATION:
${docs.map(d => `- ${d.title}: ${d.content.substring(0, 200)}...`).join('\n')}

Provide a brief summary (2-3 sentences) highlighting key patterns and best practices.`;

  try {
    const response = await ai.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: 'You are a security expert summarizing incident patterns.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 200,
    });

    return response.response || 'Unable to generate summary.';

  } catch (error) {
    return 'Summary generation failed.';
  }
}

function generateInsights(results: any): string[] {
  const insights: string[] = [];

  if (results.incidents.length > 0) {
    const severityCounts = results.incidents.reduce((acc: any, inc: any) => {
      acc[inc.severity] = (acc[inc.severity] || 0) + 1;
      return acc;
    }, {});

    insights.push(
      `Found ${results.incidents.length} similar past incidents (${Object.entries(severityCounts).map(([sev, count]) => `${count} ${sev}`).join(', ')})`
    );
  }

  if (results.documentation.length > 0) {
    insights.push(`${results.documentation.length} relevant documentation articles found`);
  }

  if (results.runbooks.length > 0) {
    insights.push(`${results.runbooks.length} applicable security runbooks available`);
  }

  return insights;
}

function hashQuery(query: string): string {
  // Simple hash for caching (in production, use proper hash function)
  return query.toLowerCase().replace(/\s+/g, '_').substring(0, 50);
}

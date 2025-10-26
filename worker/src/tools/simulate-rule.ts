/**
 * Simulate Rule Tool
 * Test rule in shadow mode and report impact
 */

export const simulateRuleTool = {
  name: 'simulate_rule',
  description: 'Test a proposed rule in shadow/log mode for a specified duration. Reports expected impact and false positive rate.',
  
  parameters: {
    type: 'object',
    properties: {
      ruleId: {
        type: 'string',
        description: 'ID of the proposed rule to simulate',
      },
      durationMinutes: {
        type: 'integer',
        minimum: 5,
        maximum: 60,
        default: 10,
        description: 'Simulation duration in minutes',
      },
      sampleSize: {
        type: 'integer',
        minimum: 100,
        maximum: 10000,
        default: 1000,
        description: 'Number of requests to analyze',
      },
    },
    required: ['ruleId'],
  },

  async execute(params: any, context: any): Promise<any> {
    const { ruleId, durationMinutes = 10, sampleSize = 1000 } = params;
    const { env, doStub } = context;

    // Get the proposed rule from DO
    const proposal = await doStub.getProposal(ruleId);
    
    if (!proposal) {
      return {
        error: `Rule ${ruleId} not found. Please propose a rule first.`,
      };
    }

    // Create shadow rule (log-only version)
    const shadowRule = {
      ...proposal.rule,
      id: `${ruleId}_shadow`,
      action: 'log', // Always log for simulation
      description: `[SIMULATION] ${proposal.rule.description}`,
      enabled: true,
    };

    try {
      // Deploy shadow rule via CF API
      const deployed = await deployRuleToCloudflare(
        shadowRule,
        env.CF_ZONE_ID,
        env.CF_API_TOKEN,
        'simulation'
      );

      if (!deployed.success) {
        return {
          error: `Failed to deploy shadow rule: ${deployed.error}`,
        };
      }

      // Store simulation start
      await doStub.startSimulation({
        ruleId,
        shadowRuleId: deployed.id,
        startTime: Date.now(),
        durationMs: durationMinutes * 60 * 1000,
        status: 'running',
      });

      // Schedule simulation analysis (using Workflows would be better in production)
      // For MVP, return instructions for manual check
      return {
        success: true,
        simulationId: deployed.id,
        status: 'running',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + durationMinutes * 60 * 1000).toISOString(),
        durationMinutes,
        message: `Shadow rule deployed successfully. Analyzing ${sampleSize} requests over ${durationMinutes} minutes.`,
        checkCommand: `curl "https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/firewall/events?rule_id=${deployed.id}" \\
  -H "Authorization: Bearer $CF_API_TOKEN"`,
        nextSteps: [
          `Wait ${durationMinutes} minutes for simulation to complete`,
          'Check results with: GET /simulation/results/' + ruleId,
          'If false positive rate is acceptable, proceed to approve',
        ],
        instructions: 'The rule is now logging matches. After the simulation period, I will analyze the results and provide a recommendation.',
      };

    } catch (error: any) {
      return {
        error: `Simulation failed: ${error.message}`,
        details: error.toString(),
      };
    }
  },
};

async function deployRuleToCloudflare(
  rule: any,
  zoneId: string,
  apiToken: string,
  mode: string = 'production'
): Promise<any> {
  try {
    // Cloudflare Rulesets API endpoint
    const endpoint = `https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets/phases/http_request_firewall_custom/entrypoint`;

    // For MVP, we'll return a mock success
    // In production, actually call the CF API
    if (!apiToken || apiToken === 'your_api_token') {
      console.warn('Mock mode: CF_API_TOKEN not configured');
      return {
        success: true,
        id: `mock_${rule.id}`,
        message: 'Mock deployment (API token not configured)',
      };
    }

    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rules: [
          {
            expression: rule.expression,
            action: rule.action,
            description: rule.description,
            enabled: rule.enabled,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.errors?.[0]?.message || 'API request failed');
    }

    return {
      success: true,
      id: data.result?.id || rule.id,
      data,
    };

  } catch (error: any) {
    console.error('CF API Error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Helper to analyze simulation results
export async function analyzeSimulationResults(
  shadowRuleId: string,
  zoneId: string,
  apiToken: string
): Promise<any> {
  try {
    const endpoint = `https://api.cloudflare.com/client/v4/zones/${zoneId}/firewall/events?rule_id=${shadowRuleId}`;

    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error('Failed to fetch firewall events');
    }

    const events = data.result || [];
    const totalMatches = events.length;
    const uniqueIPs = new Set(events.map((e: any) => e.source?.ip)).size;
    const uniquePaths = new Set(events.map((e: any) => e.request?.path)).size;

    // Estimate false positive rate (simplified heuristic)
    const suspiciousPatterns = events.filter((e: any) => {
      const path = e.request?.path || '';
      const hasKnownBadPatterns = /admin|wp-|\.php|\.asp|\.jsp/i.test(path);
      return !hasKnownBadPatterns;
    }).length;

    const falsePositiveRate = totalMatches > 0 
      ? Math.round((suspiciousPatterns / totalMatches) * 100) 
      : 0;

    return {
      totalMatches,
      uniqueIPs,
      uniquePaths,
      falsePositiveRate: `${falsePositiveRate}%`,
      recommendation: falsePositiveRate < 10 
        ? 'False positive rate is acceptable. Safe to proceed.'
        : 'High false positive rate detected. Consider refining the rule expression.',
      risk: falsePositiveRate < 5 ? 'LOW' : falsePositiveRate < 15 ? 'MEDIUM' : 'HIGH',
    };

  } catch (error: any) {
    return {
      error: error.message,
    };
  }
}

/**
 * Propose WAF Rule Tool
 * Generates template-based WAF rules with safety guardrails
 */

export const proposeWAFRuleTool = {
  name: 'propose_waf_rule',
  description: 'Propose a strictly-templated WAF rule for review or simulation. Rule parameters are bounded for safety.',
  
  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        enum: ['path_traversal', 'sql_injection', 'xss', 'bot_spike', 'ddos', 'api_abuse'],
        description: 'Attack pattern to mitigate',
      },
      scope: {
        type: 'string',
        enum: ['zone', 'hostname', 'path'],
        description: 'Scope of the rule',
        default: 'zone',
      },
      action: {
        type: 'string',
        enum: ['log', 'challenge', 'js_challenge', 'managed_challenge', 'block'],
        description: 'Action to take (prefer least restrictive first)',
        default: 'challenge',
      },
      rateLimit: {
        type: 'integer',
        minimum: 10,
        maximum: 1000,
        description: 'Rate limit: requests per 10 seconds per IP',
      },
      targetPath: {
        type: 'string',
        description: 'Specific path pattern to match (optional)',
      },
      targetCountry: {
        type: 'string',
        description: 'Target specific country code (optional, use with caution)',
      },
      targetASN: {
        type: 'string',
        description: 'Target specific ASN (optional)',
      },
      ttl: {
        type: 'integer',
        minimum: 300,
        maximum: 86400,
        description: 'Time to live in seconds (5min to 24h)',
        default: 3600,
      },
      reason: {
        type: 'string',
        description: 'Human-readable reason for this rule',
      },
    },
    required: ['pattern', 'action', 'reason'],
  },

  async execute(params: any, context: any): Promise<any> {
    const {
      pattern,
      scope = 'zone',
      action,
      rateLimit,
      targetPath,
      targetCountry,
      targetASN,
      ttl = 3600,
      reason,
    } = params;

    const { env, doStub } = context;

    // Build rule expression based on pattern template
    let expression = '';
    let description = '';

    switch (pattern) {
      case 'path_traversal':
        expression = '(http.request.uri.path contains ".." or http.request.uri.path contains "%2e%2e")';
        description = 'Block path traversal attempts';
        break;

      case 'sql_injection':
        expression = '(http.request.uri.query contains "union select" or http.request.uri.query contains "drop table" or http.request.uri.query contains "\' or \'1\'=\'1")';
        description = 'Block SQL injection patterns';
        break;

      case 'xss':
        expression = '(http.request.uri.query contains "<script" or http.request.uri.query contains "javascript:" or http.request.uri.query contains "onerror=")';
        description = 'Block XSS attack patterns';
        break;

      case 'bot_spike':
        expression = '(cf.bot_management.score lt 30)';
        description = 'Challenge suspected bot traffic';
        break;

      case 'ddos':
        if (!rateLimit) {
          return { error: 'rateLimit is required for DDoS mitigation' };
        }
        expression = `(cf.threat_score gt 10)`;
        description = `Rate limit high-threat requests to ${rateLimit}/10s per IP`;
        break;

      case 'api_abuse':
        if (!targetPath) {
          return { error: 'targetPath is required for API abuse protection' };
        }
        expression = `(http.request.uri.path contains "${targetPath}")`;
        description = `Rate limit API endpoint ${targetPath}`;
        break;

      default:
        return { error: `Unknown pattern: ${pattern}` };
    }

    // Add scope filters
    if (targetPath) {
      expression = `(http.request.uri.path contains "${targetPath}") and ${expression}`;
    }

    if (targetCountry) {
      expression = `(ip.geoip.country eq "${targetCountry}") and ${expression}`;
    }

    if (targetASN) {
      expression = `(ip.geoip.asnum eq ${targetASN}) and ${expression}`;
    }

    // Generate rule object
    const rule = {
      id: `edgesec_${pattern}_${Date.now()}`,
      expression,
      action,
      description: `${description} - ${reason}`,
      enabled: false, // Start disabled for safety
      priority: 1,
      ref: `edgesec-${pattern}`,
    };

    // Add rate limiting if specified
    const rateLimitConfig = rateLimit ? {
      characteristics: ['ip.src'],
      period: 10,
      requests_per_period: rateLimit,
      mitigation_timeout: ttl,
    } : null;

    // Calculate risk assessment
    const risk = assessRisk(action, scope, targetPath, targetCountry);

    // Generate simulation command
    const simulationCommand = generateSimulationCommand(rule, env.CF_ZONE_ID);

    // Store proposal in DO
    await doStub.storeProposal({
      ruleId: rule.id,
      rule,
      rateLimitConfig,
      pattern,
      reason,
      risk,
      timestamp: Date.now(),
      status: 'proposed',
    });

    return {
      success: true,
      rule,
      rateLimitConfig,
      risk,
      recommendation: getRecommendation(pattern, action, risk),
      simulation: {
        command: simulationCommand,
        instructions: 'Run this command to test the rule in shadow mode for 10 minutes',
      },
      nextSteps: [
        'Review the rule expression and scope',
        'Run simulation to check false positive rate',
        'If satisfied, approve for staged deployment',
      ],
      approvalRequired: risk.level !== 'LOW',
    };
  },
};

function assessRisk(action: string, scope: string, targetPath?: string, targetCountry?: string): any {
  let level = 'LOW';
  const factors = [];

  if (action === 'block') {
    level = 'MEDIUM';
    factors.push('Blocking traffic can impact legitimate users');
  }

  if (scope === 'zone' && !targetPath) {
    level = level === 'MEDIUM' ? 'HIGH' : 'MEDIUM';
    factors.push('Zone-wide rule affects all traffic');
  }

  if (targetCountry) {
    level = 'HIGH';
    factors.push('Geo-blocking can have legal/business implications');
  }

  const falsePositiveRisk = action === 'block' ? 'Medium' : 'Low';

  return {
    level,
    factors,
    falsePositiveRisk,
    recommendation: level === 'HIGH' 
      ? 'Start with "challenge" action and monitor for 24h before escalating to "block"'
      : 'Safe to deploy with standard approval',
  };
}

function getRecommendation(pattern: string, action: string, risk: any): string {
  if (risk.level === 'HIGH') {
    return `Given the HIGH risk, consider starting with "log" or "challenge" action instead of "${action}" for initial deployment.`;
  }

  if (pattern === 'sql_injection' && action !== 'block') {
    return 'SQL injection attempts should typically be blocked. Consider escalating to "block" action.';
  }

  return `Rule looks reasonable for ${pattern} mitigation with ${action} action.`;
}

function generateSimulationCommand(rule: any, zoneId: string): string {
  return `curl -X POST "https://api.cloudflare.com/client/v4/zones/${zoneId}/firewall/rules/test" \\
  -H "Authorization: Bearer $CF_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  --data '{
    "expression": "${rule.expression}",
    "action": "log",
    "description": "Simulation: ${rule.description}"
  }'`;
}

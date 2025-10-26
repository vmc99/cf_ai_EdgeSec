/**
 * Analyze Traffic Pattern Tool
 * Parses log samples and identifies security anomalies
 */

export const analyzeTrafficTool = {
  name: 'analyze_traffic_pattern',
  description: 'Parse log samples and identify security anomalies like DDoS, SQL injection, path traversal, bot spikes. Returns threat classification with confidence score.',
  
  parameters: {
    type: 'object',
    properties: {
      logs: {
        type: 'array',
        description: 'Array of log entries to analyze',
        items: {
          type: 'object',
          properties: {
            timestamp: { type: 'string' },
            clientIP: { type: 'string' },
            path: { type: 'string' },
            method: { type: 'string' },
            statusCode: { type: 'number' },
            userAgent: { type: 'string' },
            country: { type: 'string' },
            asn: { type: 'string' },
          },
        },
      },
      timeWindow: {
        type: 'string',
        description: 'Time window for analysis (e.g., "5m", "1h")',
        default: '10m',
      },
    },
    required: ['logs'],
  },

  async execute(params: any, context: any): Promise<any> {
    const { logs, timeWindow = '10m' } = params;
    const { env, doStub } = context;

    if (!logs || logs.length === 0) {
      return {
        error: 'No logs provided',
        anomalies: [],
      };
    }

    // Analyze patterns
    const patterns = {
      pathTraversal: 0,
      sqlInjection: 0,
      xss: 0,
      botSpike: 0,
      ddos: 0,
      apiAbuse: 0,
    };

    const ipFrequency = new Map<string, number>();
    const pathFrequency = new Map<string, number>();
    const suspiciousIPs = new Set<string>();
    const suspiciousPaths = new Set<string>();

    // Pattern matching
    const pathTraversalRegex = /\.\.[\/\\]|\.\.%2[fF]|%2e%2e/;
    const sqlInjectionRegex = /(\bunion\b|\bselect\b|\binsert\b|\bdrop\b|\bdelete\b|\bupdate\b).+(\bfrom\b|\bwhere\b|\btable\b)|['"]\s*(or|and)\s*['"]\s*=\s*['"]/i;
    const xssRegex = /<script|javascript:|onerror=|onload=/i;

    logs.forEach((log: any) => {
      const { clientIP, path, method, statusCode, userAgent } = log;

      // Count IP frequency
      ipFrequency.set(clientIP, (ipFrequency.get(clientIP) || 0) + 1);

      // Count path frequency
      pathFrequency.set(path, (pathFrequency.get(path) || 0) + 1);

      // Detect patterns
      if (pathTraversalRegex.test(path)) {
        patterns.pathTraversal++;
        suspiciousIPs.add(clientIP);
        suspiciousPaths.add(path);
      }

      if (sqlInjectionRegex.test(path)) {
        patterns.sqlInjection++;
        suspiciousIPs.add(clientIP);
        suspiciousPaths.add(path);
      }

      if (xssRegex.test(path)) {
        patterns.xss++;
        suspiciousIPs.add(clientIP);
        suspiciousPaths.add(path);
      }

      // Bot detection (simple heuristic)
      if (userAgent && (userAgent.includes('bot') || userAgent.includes('crawler') || userAgent.length < 10)) {
        patterns.botSpike++;
      }
    });

    // DDoS detection: High request rate from few IPs
    const avgRequestsPerIP = logs.length / ipFrequency.size;
    ipFrequency.forEach((count, ip) => {
      if (count > avgRequestsPerIP * 5) {
        patterns.ddos++;
        suspiciousIPs.add(ip);
      }
    });

    // API abuse: High rate to specific endpoints
    pathFrequency.forEach((count, path) => {
      if (count > logs.length * 0.3 && (path.includes('/api/') || path.includes('/graphql'))) {
        patterns.apiAbuse++;
        suspiciousPaths.add(path);
      }
    });

    // Calculate threat severity
    const totalPatterns = Object.values(patterns).reduce((a, b) => a + b, 0);
    const severity = totalPatterns > logs.length * 0.1 ? 'HIGH' : 
                     totalPatterns > logs.length * 0.05 ? 'MEDIUM' : 'LOW';
    
    const confidence = Math.min(95, Math.round((totalPatterns / logs.length) * 100 * 10));

    // Build anomaly report
    const anomalies = [];
    
    if (patterns.pathTraversal > 0) {
      anomalies.push({
        type: 'path_traversal',
        count: patterns.pathTraversal,
        severity: 'HIGH',
        description: `Detected ${patterns.pathTraversal} path traversal attempts`,
        affectedPaths: Array.from(suspiciousPaths).filter(p => pathTraversalRegex.test(p)),
        recommendation: 'Block requests matching path traversal patterns',
      });
    }

    if (patterns.sqlInjection > 0) {
      anomalies.push({
        type: 'sql_injection',
        count: patterns.sqlInjection,
        severity: 'CRITICAL',
        description: `Detected ${patterns.sqlInjection} SQL injection attempts`,
        affectedPaths: Array.from(suspiciousPaths).filter(p => sqlInjectionRegex.test(p)),
        recommendation: 'Block requests with SQL injection patterns',
      });
    }

    if (patterns.xss > 0) {
      anomalies.push({
        type: 'xss',
        count: patterns.xss,
        severity: 'HIGH',
        description: `Detected ${patterns.xss} XSS attempts`,
        affectedPaths: Array.from(suspiciousPaths).filter(p => xssRegex.test(p)),
        recommendation: 'Block requests with XSS payloads',
      });
    }

    if (patterns.ddos > 0) {
      const topIPs = Array.from(ipFrequency.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      
      anomalies.push({
        type: 'ddos',
        count: patterns.ddos,
        severity: 'CRITICAL',
        description: `Potential DDoS from ${suspiciousIPs.size} IPs with high request rates`,
        topIPs: topIPs.map(([ip, count]) => ({ ip, requests: count })),
        recommendation: 'Apply rate limiting per IP or ASN',
      });
    }

    if (patterns.botSpike > logs.length * 0.3) {
      anomalies.push({
        type: 'bot_spike',
        count: patterns.botSpike,
        severity: 'MEDIUM',
        description: `High bot traffic: ${patterns.botSpike} requests (${Math.round(patterns.botSpike / logs.length * 100)}%)`,
        recommendation: 'Enable Bot Management or add challenge',
      });
    }

    if (patterns.apiAbuse > 0) {
      anomalies.push({
        type: 'api_abuse',
        count: patterns.apiAbuse,
        severity: 'MEDIUM',
        description: `API abuse detected on ${patterns.apiAbuse} endpoints`,
        affectedPaths: Array.from(suspiciousPaths).filter(p => p.includes('/api/') || p.includes('/graphql')),
        recommendation: 'Apply endpoint-specific rate limiting',
      });
    }

    // Store analysis in DO
    await doStub.storeAnalysis({
      timestamp: Date.now(),
      logsAnalyzed: logs.length,
      anomalies,
      severity,
      confidence,
      suspiciousIPs: Array.from(suspiciousIPs),
      suspiciousPaths: Array.from(suspiciousPaths),
    });

    return {
      summary: {
        logsAnalyzed: logs.length,
        anomaliesFound: anomalies.length,
        severity,
        confidence: `${confidence}%`,
        timeWindow,
      },
      anomalies,
      statistics: {
        uniqueIPs: ipFrequency.size,
        uniquePaths: pathFrequency.size,
        suspiciousIPs: suspiciousIPs.size,
        suspiciousPaths: suspiciousPaths.size,
      },
      topIPs: Array.from(ipFrequency.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([ip, count]) => ({ ip, requests: count })),
    };
  },
};

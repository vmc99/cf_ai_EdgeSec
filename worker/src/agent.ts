import { analyzeTrafficTool } from './tools/analyze-traffic.js';
import { proposeWAFRuleTool } from './tools/propose-waf-rule.js';
import { simulateRuleTool } from './tools/simulate-rule.js';
import { querySimilarIncidentsTool } from './tools/query-similar-incidents.js';
import { getRagContext } from './rag.js';

const SYSTEM_PROMPT = `You are EdgeSec Copilot, an AI-powered security advisor for Cloudflare.

Your role is to:
1. Answer questions about web security, WAF rules, and threat mitigation using your knowledge base
2. Analyze security logs when provided and identify potential threats
3. Recommend WAF rules and security configurations (but NOT apply them)
4. Run simulations to show potential impact of proposed rules
5. Provide best practices from Cloudflare documentation

Core capabilities:
- **RAG-powered answers**: Use embedded documentation to provide accurate, context-aware responses
- **Log analysis**: Identify attack patterns like SQL injection, XSS, DDoS, bot traffic
- **Rule recommendations**: Suggest specific WAF rules with clear rationale
- **Impact simulation**: Show what-if scenarios for proposed changes
- **Conversation memory**: Remember context within your session

IMPORTANT Guidelines:
- If asked about logs WITHOUT log data: "Please upload a log file using the 'Upload' tab. I can analyze JSON logs with fields like clientIP, path, method, statusCode, userAgent, etc."
- Always explain your reasoning and cite sources when possible
- Highlight false-positive risks and suggest testing approaches
- This is an advisory tool - you CANNOT apply changes to production systems
- Users must implement recommended rules manually in their Cloudflare dashboard

Available tools:
- analyze_traffic_pattern: Analyze uploaded logs for threats
- propose_waf_rule: Generate WAF rule recommendations
- simulate_rule: Run what-if simulations on rules
- query_similar_incidents: Search past incidents for context

When analyzing logs:
1. Identify attack patterns and anomalies
2. Calculate threat severity and confidence
3. Provide specific, actionable recommendations
4. Include expected impact and false-positive considerations

When recommending rules:
1. Provide complete WAF rule expressions
2. Explain what the rule blocks and why
3. Suggest appropriate actions (log, challenge, block)
4. Recommend rate limits where applicable
5. Note any compliance or business logic considerations

Always be concise, helpful, and security-focused.`;

// Simple agent implementation without the complex SDK
export async function createAgent(env: any, doStub: any) {
  return {
    async run(message: string, options: any = {}) {
      try {
        // Get RAG context
        const ragContext = await getRagContext(env.VECTORIZE, env.AI, message);
        
        // Build system message with context
        let systemMessage = SYSTEM_PROMPT;
        if (ragContext.length > 0) {
          systemMessage += `\n\n[RELEVANT DOCUMENTATION]\n${ragContext.join('\n\n')}`;
        }

        // Build conversation messages with history
        const messages: Array<{ role: string; content: string }> = [
          { role: 'system', content: systemMessage }
        ];

        // Add conversation history if provided
        if (options.history && Array.isArray(options.history)) {
          messages.push(...options.history);
        }

        // Add current user message
        messages.push({ role: 'user', content: message });

        // Call Workers AI with full conversation context
        const response = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
          messages,
          max_tokens: 4096,
          temperature: 0.3,
        });

        const responseContent = response.response || 'Sorry, I encountered an error processing your request.';

        // Save conversation turn to Durable Object for persistence
        try {
          console.log('[Agent] Saving conversation to Durable Object...');
          console.log('[Agent] doStub:', doStub);
          console.log('[Agent] doStub.addConversationTurn:', typeof doStub.addConversationTurn);
          
          await doStub.addConversationTurn({
            role: 'user',
            content: message,
            timestamp: Date.now(),
          });
          console.log('[Agent] User turn saved');
          
          await doStub.addConversationTurn({
            role: 'assistant',
            content: responseContent,
            timestamp: Date.now(),
          });
          console.log('[Agent] Assistant turn saved');
        } catch (storageError) {
          console.error('[Agent] Failed to save conversation to storage:', storageError);
          // Don't fail the request if storage fails
        }

        return {
          content: responseContent,
          timestamp: Date.now(),
        };
      } catch (error: any) {
        console.error('Agent error:', error);
        return {
          content: `Error: ${error.message || 'Failed to process request'}`,
          timestamp: Date.now(),
        };
      }
    }
  };
}

export interface AgentContext {
  sessionId: string;
  accountId?: string;
  timestamp: number;
}

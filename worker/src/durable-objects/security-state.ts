/**
 * Security State Durable Object
 * Manages conversation history, rule proposals, and incident tracking per account/zone
 */

import { DurableObject } from 'cloudflare:workers';

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  toolCalls?: any[];
}

export interface RuleProposal {
  ruleId: string;
  rule: any;
  rateLimitConfig?: any;
  pattern: string;
  reason: string;
  risk: any;
  timestamp: number;
  status: 'proposed' | 'simulating' | 'deploying' | 'applied' | 'rolled_back' | 'failed';
  simulationId?: string;
  workflowId?: string;
  appliedRuleId?: string;
  appliedAt?: number;
  rolledBackAt?: number;
  rollbackReason?: string;
  error?: string;
}

export interface SecurityAnalysis {
  timestamp: number;
  logsAnalyzed: number;
  anomalies: any[];
  severity: string;
  confidence: string;
  suspiciousIPs: string[];
  suspiciousPaths: string[];
}

export class SecurityStateDO extends DurableObject {
  private conversationHistory: ConversationTurn[] = [];
  private proposals: Map<string, RuleProposal> = new Map();
  private analyses: SecurityAnalysis[] = [];
  private simulations: Map<string, any> = new Map();

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
  }

  async initialize() {
    // Load state from storage
    const stored = await this.ctx.storage.get<any>('state');
    if (stored) {
      this.conversationHistory = stored.conversationHistory || [];
      this.proposals = new Map(Object.entries(stored.proposals || {}));
      this.analyses = stored.analyses || [];
      this.simulations = new Map(Object.entries(stored.simulations || {}));
    }
  }

  async persist() {
    await this.ctx.storage.put('state', {
      conversationHistory: this.conversationHistory,
      proposals: Object.fromEntries(this.proposals),
      analyses: this.analyses,
      simulations: Object.fromEntries(this.simulations),
    });
  }

  // Conversation Management
  async addConversationTurn(turn: ConversationTurn) {
    console.log('[DO] addConversationTurn called with:', turn);
    await this.initialize();
    console.log('[DO] Current history length:', this.conversationHistory.length);
    this.conversationHistory.push(turn);
    
    // Keep last 50 turns
    if (this.conversationHistory.length > 50) {
      this.conversationHistory = this.conversationHistory.slice(-50);
    }
    
    await this.persist();
    console.log('[DO] Conversation saved, new length:', this.conversationHistory.length);
  }

  async getConversationHistory(limit: number = 20) {
    console.log('[DO] getConversationHistory called with limit:', limit);
    await this.initialize();
    console.log('[DO] Returning', this.conversationHistory.length, 'turns');
    return this.conversationHistory.slice(-limit);
  }

  async clearConversationHistory() {
    await this.initialize();
    this.conversationHistory = [];
    await this.persist();
  }

  // Traffic Analysis
  async analyzeTraffic(logs: any[]) {
    // This would be called by the analyze_traffic tool
    // Returning a simple response for now
    return {
      message: 'Traffic analysis initiated',
      logsReceived: logs.length,
    };
  }

  async storeAnalysis(analysis: SecurityAnalysis) {
    await this.initialize();
    this.analyses.push(analysis);
    
    // Keep last 100 analyses
    if (this.analyses.length > 100) {
      this.analyses = this.analyses.slice(-100);
    }
    
    await this.persist();
  }

  async getRecentAnalyses(limit: number = 10) {
    await this.initialize();
    return this.analyses.slice(-limit);
  }

  // Rule Proposals
  async storeProposal(proposal: RuleProposal) {
    await this.initialize();
    this.proposals.set(proposal.ruleId, proposal);
    await this.persist();
  }

  async getProposal(ruleId: string): Promise<RuleProposal | undefined> {
    await this.initialize();
    return this.proposals.get(ruleId);
  }

  async getProposalByAppliedId(appliedRuleId: string): Promise<RuleProposal | undefined> {
    await this.initialize();
    for (const proposal of this.proposals.values()) {
      if (proposal.appliedRuleId === appliedRuleId) {
        return proposal;
      }
    }
    return undefined;
  }

  async updateProposal(ruleId: string, updates: Partial<RuleProposal>) {
    await this.initialize();
    const proposal = this.proposals.get(ruleId);
    if (proposal) {
      this.proposals.set(ruleId, { ...proposal, ...updates });
      await this.persist();
    }
  }

  async getRecommendationHistory() {
    await this.initialize();
    return Array.from(this.proposals.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  // Simulation Management
  async startSimulation(simulation: any) {
    await this.initialize();
    this.simulations.set(simulation.ruleId, simulation);
    await this.persist();
  }

  async getSimulation(ruleId: string) {
    await this.initialize();
    return this.simulations.get(ruleId);
  }

  async updateSimulation(ruleId: string, updates: any) {
    await this.initialize();
    const simulation = this.simulations.get(ruleId);
    if (simulation) {
      this.simulations.set(ruleId, { ...simulation, ...updates });
      await this.persist();
    }
  }

  // Search similar incidents
  async searchIncidents(query: string, limit: number = 5) {
    await this.initialize();
    
    // Simple text search (in production, use vector similarity)
    const lowerQuery = query.toLowerCase();
    
    const matches = this.analyses
      .filter(analysis => {
        const anomalyTypes = analysis.anomalies.map((a: any) => a.type).join(' ');
        const description = analysis.anomalies.map((a: any) => a.description).join(' ');
        return anomalyTypes.toLowerCase().includes(lowerQuery) || 
               description.toLowerCase().includes(lowerQuery);
      })
      .slice(-limit);

    return matches.map(analysis => ({
      timestamp: analysis.timestamp,
      anomalies: analysis.anomalies,
      severity: analysis.severity,
      summary: analysis.anomalies[0]?.description || 'Security anomaly detected',
    }));
  }

  // Statistics
  async getStatistics() {
    await this.initialize();
    
    const totalProposals = this.proposals.size;
    const appliedRules = Array.from(this.proposals.values())
      .filter(p => p.status === 'applied').length;
    const rolledBack = Array.from(this.proposals.values())
      .filter(p => p.status === 'rolled_back').length;
    
    return {
      conversationTurns: this.conversationHistory.length,
      totalAnalyses: this.analyses.length,
      totalProposals,
      appliedRules,
      rolledBack,
      activeSimulations: Array.from(this.simulations.values())
        .filter(s => s.status === 'running').length,
    };
  }

  // Fetch handler for direct DO access
  async fetch(request: Request) {
    const url = new URL(request.url);
    
    try {
      switch (url.pathname) {
        case '/history':
          return new Response(JSON.stringify({
            conversation: await this.getConversationHistory(),
            analyses: await this.getRecentAnalyses(),
            recommendations: await this.getRecommendationHistory(),
          }), {
            headers: { 'Content-Type': 'application/json' },
          });

        case '/stats':
          return new Response(JSON.stringify(await this.getStatistics()), {
            headers: { 'Content-Type': 'application/json' },
          });

        case '/clear':
          if (request.method === 'POST') {
            await this.clearConversationHistory();
            return new Response(JSON.stringify({ success: true }), {
              headers: { 'Content-Type': 'application/json' },
            });
          }
          break;
      }

      return new Response('Not Found', { status: 404 });

    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
}

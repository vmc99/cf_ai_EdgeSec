import React, { useEffect, useState } from 'react';

interface RuleHistoryProps {
  sessionId: string;
  workerUrl: string;
}

interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const RuleHistory: React.FC<RuleHistoryProps> = ({ sessionId, workerUrl }) => {
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('RuleHistory mounted with sessionId:', sessionId);
    fetchHistory();
  }, [sessionId]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const url = `${workerUrl}/recommendations/history?sessionId=${sessionId}`;
      console.log('Fetching history from:', url);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch history');
      }

      const data = await response.json() as { 
        conversation: ConversationTurn[];
      };
      console.log('History data received:', data);
      setConversation(data.conversation || []);
      setError(null);
    } catch (err) {
      console.error('History fetch error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="rounded-3xl border border-slate-800/70 bg-slate-950/70 px-10 py-8 text-center shadow-[0_18px_44px_rgba(2,6,23,0.55)]">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full border-4 border-sky-400 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-400">Loading rule history…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-8 text-center">
        <svg className="mx-auto mb-4 h-12 w-12 text-rose-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="mb-2 text-sm font-semibold text-rose-100">Failed to load history</p>
        <p className="mb-4 text-xs text-rose-100/70">{error}</p>
        <button
          onClick={fetchHistory}
          className="inline-flex items-center gap-2 rounded-2xl border border-rose-400/40 bg-slate-950/30 px-4 py-2 text-xs font-semibold text-rose-100 transition hover:border-rose-300/60"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (conversation.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-800/70 bg-slate-950/70 p-12 text-center shadow-[0_18px_44px_rgba(2,6,23,0.55)]">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-900/80">
          <svg className="h-10 w-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-slate-100">No conversation yet</h3>
        <p className="mx-auto mt-3 max-w-md text-sm text-slate-400">
          Start chatting or upload logs to see your conversation history here.
        </p>
        <div className="mt-6 rounded-2xl border border-slate-800/70 bg-slate-900/50 p-4">
          <p className="text-xs text-slate-500 mb-2">Current Session ID:</p>
          <code className="text-xs text-cyan-400 break-all">{sessionId}</code>
          <button
            onClick={() => {
              localStorage.removeItem('edgesec-session-id');
              window.location.reload();
            }}
            className="mt-3 block text-xs text-slate-500 hover:text-cyan-400 transition"
          >
            Clear session and start new
          </button>
        </div>
        <button
          onClick={fetchHistory}
          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-sky-500 px-6 py-2 text-sm font-semibold text-slate-950 transition hover:from-cyan-300 hover:to-sky-400"
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* History Header */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-800/70 bg-slate-950/70 px-6 py-6 shadow-[0_18px_44px_rgba(2,6,23,0.55)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">History</h2>
          <p className="text-xs uppercase tracking-widest text-slate-500">{conversation.length} message{conversation.length === 1 ? '' : 's'}</p>
        </div>
        <button
          onClick={fetchHistory}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-800/70 bg-slate-900/70 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-200"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Conversation Messages */}
      <div className="space-y-4 max-h-[600px] overflow-y-auto">
        {conversation.map((turn, index) => (
          <div 
            key={index} 
            className={`rounded-3xl border border-slate-800/70 bg-slate-950/70 p-6 shadow-[0_12px_32px_rgba(2,6,23,0.45)] ${
              turn.role === 'user' ? 'border-cyan-400/20' : 'border-slate-800/70'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                turn.role === 'user' ? 'bg-cyan-500/10' : 'bg-sky-500/10'
              }`}>
                {turn.role === 'user' ? (
                  <svg className="h-4 w-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  {turn.role === 'user' ? 'You' : 'EdgeSec AI'}
                </div>
              </div>
              <div className="text-xs text-slate-500">
                {new Date(turn.timestamp).toLocaleString()}
              </div>
            </div>
            <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
              {turn.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RuleHistory;

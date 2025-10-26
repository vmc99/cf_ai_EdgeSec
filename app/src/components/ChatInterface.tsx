import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, isLoading }) => {
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) {
      return;
    }

    onSendMessage(trimmed);
    setInput('');
  };

  const suggestions = [
    'Summarize anomalies in the latest logs',
    'Draft a WAF rule for SQL injection',
    'Highlight requests with elevated risk',
  ];

  return (
    <div className="flex h-full flex-col bg-[#1e1e1e]">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-8">
          {messages.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center min-h-[70vh]">
              <h1 className="text-4xl font-medium text-[#e3e3e3] mb-12">EdgeSec Copilot</h1>
              
              <div className="w-full max-w-2xl space-y-3">
                {suggestions.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setInput(prompt)}
                    className="w-full text-left px-5 py-4 rounded-xl bg-[#2a2a2a] hover:bg-[#333333] transition-colors text-sm text-[#e3e3e3]"
                    type="button"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {messages.map((message, index) => {
                const isUser = message.role === 'user';
                return (
                  <div key={`${message.role}-${index}`} className="space-y-2">
                    <div className="text-xs font-medium text-[#9b9b9b] uppercase tracking-wider">
                      {isUser ? 'You' : 'EdgeSec'}
                    </div>
                    <div className="text-[#e3e3e3] text-base leading-relaxed prose prose-invert prose-sm max-w-none 
                      prose-headings:text-[#e3e3e3] prose-headings:font-semibold prose-headings:mb-4 prose-headings:mt-8 first:prose-headings:mt-0
                      prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-h4:text-sm
                      prose-p:text-[#e3e3e3] prose-p:my-4 prose-p:leading-7
                      prose-strong:text-[#e3e3e3] prose-strong:font-semibold
                      prose-code:text-[#a3e635] prose-code:bg-[#2a2a2a] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
                      prose-pre:bg-[#2a2a2a] prose-pre:border prose-pre:border-[#3a3a3a] prose-pre:rounded-lg prose-pre:p-4 prose-pre:my-6
                      prose-ul:my-4 prose-ul:space-y-2 prose-ol:my-4 prose-ol:space-y-2
                      prose-li:text-[#e3e3e3] prose-li:my-2 prose-li:leading-7
                      prose-blockquote:border-l-[#4a4a4a] prose-blockquote:text-[#b3b3b3] prose-blockquote:my-6 prose-blockquote:py-2">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  </div>
                );
              })}
              {isLoading && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-[#9b9b9b] uppercase tracking-wider">EdgeSec</div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#5f6368] animate-bounce" />
                    <span className="w-2 h-2 rounded-full bg-[#5f6368] animate-bounce" style={{ animationDelay: '0.15s' }} />
                    <span className="w-2 h-2 rounded-full bg-[#5f6368] animate-bounce" style={{ animationDelay: '0.3s' }} />
                  </div>
                </div>
              )}
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-[#2a2a2a] bg-[#1e1e1e]">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <form onSubmit={handleSubmit} className="relative">
            <div className="relative flex items-center gap-3 bg-[#2a2a2a] rounded-3xl px-5 py-3 focus-within:bg-[#333333] transition-colors">
              <input
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    handleSubmit(event);
                  }
                }}
                placeholder="Ask EdgeSec"
                disabled={isLoading}
                className="flex-1 bg-transparent text-[#e3e3e3] placeholder-[#9b9b9b] outline-none text-base"
              />

              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="flex-shrink-0 text-[#9b9b9b] hover:text-[#e3e3e3] transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
          </form>
          
          <div className="text-center mt-3">
            <p className="text-xs text-[#757575]">Powered by Cloudflare AI</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;

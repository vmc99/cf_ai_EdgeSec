import { useState } from 'react';
import ChatInterface from './components/ChatInterface';
import LogUpload from './components/LogUpload';
import History from './components/History';
import Header from './components/Header';

const WORKER_URL = 'http://localhost:8787';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId] = useState(() => {
    // Get or create session ID and persist it in localStorage
    let storedSessionId = localStorage.getItem('edgesec-session-id');
    if (!storedSessionId) {
      storedSessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem('edgesec-session-id', storedSessionId);
    }
    return storedSessionId;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'upload' | 'history'>('chat');
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  const sendMessage = async (content: string) => {
    const userMessage: Message = {
      id: `${Date.now()}_user`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Include recent conversation history (last 10 messages)
      const conversationHistory = messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await fetch(`${WORKER_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          sessionId,
          accountId: 'demo_account',
          history: conversationHistory,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: `${Date.now()}_assistant`,
        role: 'assistant',
        content: data.content || data.response || 'Sorry, I encountered an error.',
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);

      const errorMessage: Message = {
        id: `${Date.now()}_error`,
        role: 'assistant',
        content: '⚠️ Unable to reach Workers AI. Please confirm the worker is running on ' + WORKER_URL,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogUpload = async (file: File) => {
    try {
      // Read the file content
      const fileContent = await file.text();
      let logData;
      
      try {
        logData = JSON.parse(fileContent);
      } catch (parseError) {
        alert('Invalid JSON file. Please upload a valid JSON log file.');
        return;
      }

      // Create a message about the upload
      const uploadMessage: Message = {
        id: `${Date.now()}_upload`,
        role: 'assistant',
        content: `✅ "${file.name}" received. I can now run threat intelligence, anomaly baselining, and generate mitigation guidance.`,
        timestamp: Date.now(),
      };

      setActiveTab('chat');
      setMessages((prev) => [...prev, uploadMessage]);

      // Automatically analyze the logs
      setIsLoading(true);
      
      // Format the log data for analysis
      const logSummary = Array.isArray(logData) 
        ? `Analyzing ${logData.length} log entries from ${file.name}`
        : `Analyzing log data from ${file.name}`;
      
      const analysisPrompt = `I've uploaded a security log file "${file.name}". Here's the log data:\n\n\`\`\`json\n${JSON.stringify(logData, null, 2).slice(0, 5000)}\n\`\`\`\n\nPlease analyze this for security threats, anomalies, and suspicious patterns. Identify any potential attacks like SQL injection, XSS, DDoS, bot traffic, or unusual access patterns.`;

      // Send to worker for analysis
      const response = await fetch(`${WORKER_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: analysisPrompt,
          sessionId,
          accountId: 'demo_account',
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      const analysisMessage: Message = {
        id: `${Date.now()}_analysis`,
        role: 'assistant',
        content: data.content || 'Analysis complete.',
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, analysisMessage]);
      setIsLoading(false);

    } catch (error) {
      console.error('Upload error:', error);
      setIsLoading(false);
      
      const errorMessage: Message = {
        id: `${Date.now()}_error`,
        role: 'assistant',
        content: '❌ Failed to analyze the log file. Please try again.',
        timestamp: Date.now(),
      };
      
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  return (
    <div className="flex h-screen bg-[#1e1e1e] text-white">
      {/* Expandable Sidebar */}
      <aside 
        className={`${sidebarExpanded ? 'w-64' : 'w-16'} bg-[#171717] border-r border-[#2a2a2a] flex flex-col py-4 gap-4 transition-all duration-200`}
      >
        <button 
          onClick={() => setSidebarExpanded(!sidebarExpanded)}
          className="mx-3 w-10 h-10 rounded-lg bg-[#2a2a2a] hover:bg-[#333333] transition-colors flex items-center justify-center"
          title="Menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        
        <button
          onClick={() => setActiveTab('chat')}
          className={`mx-3 h-10 rounded-lg transition-colors flex items-center gap-3 px-3 ${
            activeTab === 'chat' ? 'bg-[#2a2a2a]' : 'hover:bg-[#2a2a2a]'
          }`}
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {sidebarExpanded && <span className="text-sm">Chat</span>}
        </button>

        <button
          onClick={() => setActiveTab('upload')}
          className={`mx-3 h-10 rounded-lg transition-colors flex items-center gap-3 px-3 ${
            activeTab === 'upload' ? 'bg-[#2a2a2a]' : 'hover:bg-[#2a2a2a]'
          }`}
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          {sidebarExpanded && <span className="text-sm">Upload</span>}
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`mx-3 h-10 rounded-lg transition-colors flex items-center gap-3 px-3 ${
            activeTab === 'history' ? 'bg-[#2a2a2a]' : 'hover:bg-[#2a2a2a]'
          }`}
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {sidebarExpanded && <span className="text-sm">History</span>}
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Simple Header */}
        <header className="h-14 border-b border-[#2a2a2a] flex items-center px-6">
          <h1 className="text-base font-medium text-[#e3e3e3]">EdgeSec</h1>
        </header>

        {/* Content */}
        {activeTab === 'chat' && (
          <ChatInterface
            messages={messages}
            onSendMessage={sendMessage}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'upload' && (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 py-12">
              <LogUpload onUpload={handleLogUpload} />
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 py-12">
              <History sessionId={sessionId} workerUrl={WORKER_URL} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;

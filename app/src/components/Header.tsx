import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="bg-slate-900 border-b border-slate-700">
      <div className="container mx-auto px-6 py-3.5">
        <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-1 rounded-md">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-white">EdgeSec Copilot</h1>
              <p className="text-slate-400 text-xs">AI Security Assistant</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <span className="text-slate-400 text-xs hidden md:block">
              Powered by Cloudflare Workers AI
            </span>
            <div className="flex items-center space-x-2 bg-green-900/30 border border-green-700 px-3 py-1.5 rounded-lg">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-green-300 text-xs font-medium">Online</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

import React, { useState } from 'react';

interface LogUploadProps {
  onUpload: (file: File) => Promise<void>;
}

const LogUpload: React.FC<LogUploadProps> = ({ onUpload }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await handleFileUpload(files[0]);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFileUpload(files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith('.json')) {
      alert('Please upload a JSON file');
      return;
    }

    setIsUploading(true);
    try {
      await onUpload(file);
      setUploadedFile(file.name);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const sampleLogFormat = {
    timestamp: "2024-01-15T10:30:00Z",
    clientIP: "192.168.1.100",
    path: "/api/users",
    method: "GET",
    statusCode: 200,
    userAgent: "Mozilla/5.0...",
    queryString: "id=1",
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="rounded-3xl border border-slate-800/70 bg-slate-950/70 p-8 shadow-[0_18px_44px_rgba(2,6,23,0.55)]">
        <div className="mb-8 flex flex-col gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-cyan-200">
              JSON Pipeline
            </span>
            <h2 className="mt-3 text-2xl font-semibold text-slate-100">Upload Security Telemetry</h2>
          </div>
          <p className="max-w-2xl text-sm text-slate-400">
            Drop in request traces, edge logs, or threat snapshots in JSON format. The copilot will baseline behaviour, surface anomalies, and suggest mitigation strategy.
          </p>
        </div>

        {/* Upload Area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative overflow-hidden rounded-3xl border-2 border-dashed p-12 text-center transition-all ${
            isDragging
              ? 'border-cyan-400 bg-cyan-500/10'
              : 'border-slate-700 hover:border-cyan-500/40'
          } ${isUploading ? 'cursor-wait opacity-60' : 'cursor-pointer'}`}
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute top-0 left-1/2 h-32 w-[75%] -translate-x-1/2 rounded-full bg-cyan-500/5 blur-3xl" />
          </div>
          {isUploading ? (
            <div className="flex flex-col items-center">
              <div className="mb-4 h-16 w-16 rounded-full border-4 border-cyan-400 border-t-transparent animate-spin"></div>
              <p className="font-semibold text-slate-200">Uploading and analyzing...</p>
            </div>
          ) : uploadedFile ? (
            <div className="flex flex-col items-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                <svg className="h-8 w-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="mb-2 text-lg font-semibold text-slate-100">File uploaded successfully</p>
              <p className="mb-4 text-sm text-slate-400">{uploadedFile}</p>
              <button
                onClick={() => {
                  setUploadedFile(null);
                  const input = document.getElementById('file-input') as HTMLInputElement;
                  if (input) input.value = '';
                }}
                className="text-sm font-semibold text-cyan-300 transition hover:text-cyan-200"
              >
                Upload another file
              </button>
            </div>
          ) : (
            <>
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-900/80">
                <svg className="h-11 w-11 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 16a4 4 0 01-.9-7.872A5 5 0 1115.9 6h.1a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-slate-100">Drag & drop your log file</p>
              <p className="mt-2 text-sm text-slate-500">Accepted format: JSON up to 10 MB</p>
              <p className="mt-4 text-xs uppercase tracking-widest text-slate-500">Or</p>
              <label
                htmlFor="file-input"
                className="mt-4 inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 to-sky-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:from-cyan-300 hover:to-sky-400"
              >
                Browse Files
              </label>
              <input
                id="file-input"
                type="file"
                accept=".json"
                onChange={handleFileInput}
                className="hidden"
              />
            </>
          )}
        </div>

        {/* Sample Data */}
        <div className="mt-10 rounded-3xl border border-slate-800/70 bg-slate-950/60 p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Reference schema</h3>
              <p className="mt-1 text-sm text-slate-300">
                Structure your payload like this example for best parsing fidelity.
              </p>
            </div>
            <button
              onClick={() => {
                const blob = new Blob(
                  [JSON.stringify([sampleLogFormat], null, 2)],
                  { type: 'application/json' }
                );
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'sample-log-format.json';
                a.click();
              }}
              className="inline-flex items-center gap-2 rounded-full border border-slate-800/70 bg-slate-900/60 px-3 py-1 text-xs font-semibold text-cyan-200 transition hover:border-cyan-400/40 hover:text-cyan-100"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 10v6m0 0l-3-3m3 3 3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Template
            </button>
          </div>
          <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-950/80 p-5 text-left text-xs text-slate-300">
{JSON.stringify(sampleLogFormat, null, 2)}
          </pre>
        </div>

        {/* Quick Actions */}
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5">
            <div className="mb-3 text-2xl">&#x1F50D;</div>
            <h4 className="text-sm font-semibold text-slate-200">Pattern Detection</h4>
            <p className="mt-2 text-xs text-slate-500">
              Auto-identifies OWASP vectors including SQLi, XSS, directory traversal, and credential stuffing signatures.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5">
            <div className="mb-3 text-2xl">&#x1F916;</div>
            <h4 className="text-sm font-semibold text-slate-200">AI Analysis</h4>
            <p className="mt-2 text-xs text-slate-500">
              Workers AI surfaces anomalous clusters and drafts WAF mitigations aligned to your edge posture.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5">
            <div className="mb-3 text-2xl">&#x26A1;</div>
            <h4 className="text-sm font-semibold text-slate-200">Real-time Results</h4>
            <p className="mt-2 text-xs text-slate-500">
              Instant risk scoring with contextual insights to accelerate security response.
            </p>
          </div>
        </div>

        {/* Try Sample Data */}
        <div className="mt-8 rounded-3xl border border-cyan-500/30 bg-cyan-500/10 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
            <div className="text-2xl">&#x1F4A1;</div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold uppercase tracking-widest text-cyan-100">Try sample attack data</h4>
              <p className="mt-2 text-sm text-cyan-100/80">
                We ship hostile traffic logs in <code className="rounded bg-cyan-500/20 px-1">data/sample_logs/attack_sample.json</code>. Use them to experiment with the copilot before ingesting production telemetry.
              </p>
              <button
                onClick={() => {
                  alert('In production, this would load: data/sample_logs/attack_sample.json\n\nFor now, upload your own JSON file or use the template above.');
                }}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-cyan-500/40 bg-slate-950/40 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:border-cyan-400/60"
              >
                Load Sample Data
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogUpload;

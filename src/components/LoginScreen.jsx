import React, { useState } from 'react';
import { Mic, ArrowRight, ShieldCheck } from 'lucide-react';

export default function LoginScreen({ onLogin }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter your name to proceed');
      return;
    }
    if (trimmed.length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }
    onLogin(trimmed);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-slate-50 via-indigo-50/30 to-slate-100">
      <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-3xl p-8 shadow-xl flex flex-col items-center">
        {/* App Logo */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200 mb-6">
          <Mic className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 text-center tracking-tight">Voice Memos Cloud</h1>
        <p className="text-sm text-slate-500 text-center mt-2 mb-8">
          Record, upload, and share your voice recordings with everyone on the system.
        </p>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              placeholder="e.g. Alex, Meet"
              className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none transition-all text-sm font-medium"
              autoFocus
            />
            {error && <p className="text-rose-500 text-xs mt-1.5 font-medium">{error}</p>}
          </div>

          <button
            type="submit"
            className="w-full mt-2 py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] rounded-xl font-semibold text-white shadow-md shadow-indigo-100 flex items-center justify-center gap-2 transition-all text-sm"
          >
            <span>Continue to Voice Studio</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-8 flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Simple Instant Access • No Password Needed</span>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import {
  Mic,
  Trash2,
  ListMusic,
  LogOut,
  User,
  Search,
  Database,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  Globe2
} from 'lucide-react';
import LoginScreen from './components/LoginScreen';
import RecordingCard from './components/RecordingCard';
import AudioRecorderModal from './components/AudioRecorderModal';
import AudioUploadModal from './components/AudioUploadModal';
import AudioMasteringModal from './components/AudioMasteringModal';
import {
  subscribeToRecordings,
  createRecording,
  renameRecording,
  softDeleteRecording,
  restoreRecording,
  permanentlyDeleteRecording
} from './services/recordingsService';
import { isSupabaseConfigured } from './supabase';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    return localStorage.getItem('voice_memo_user') || '';
  });

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'my' | 'trash'
  const [recordings, setRecordings] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRecorderOpen, setIsRecorderOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [masteringTargetRecording, setMasteringTargetRecording] = useState(null);

  const handleLogin = (name) => {
    setCurrentUser(name);
    localStorage.setItem('voice_memo_user', name);
  };

  const handleLogout = () => {
    setCurrentUser('');
    localStorage.removeItem('voice_memo_user');
  };

  useEffect(() => {
    const unsubscribe = subscribeToRecordings((items) => {
      setRecordings(items);
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // Active / Trash filter
  const nonDeleted = recordings.filter((r) => !r.isDeleted);
  const deletedRecordings = recordings.filter((r) => r.isDeleted);

  // Filter by Tab: Global Community vs My Recordings vs Trash
  let currentTabList = [];
  if (activeTab === 'all') {
    currentTabList = nonDeleted;
  } else if (activeTab === 'my') {
    currentTabList = nonDeleted.filter((r) => (r.author || '').toLowerCase() === currentUser.toLowerCase());
  } else {
    currentTabList = deletedRecordings;
  }

  // Search filter
  const filtered = currentTabList
    .filter(
      (item) =>
        item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.author?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
              <Globe2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 tracking-tight leading-none">Voice Community</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Global Feed
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">Shared Audio System</span>
            </div>
          </div>

          {/* User profile & status */}
          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200/80 rounded-full text-xs font-medium text-emerald-700">
              {isSupabaseConfigured ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Global Sync Live</span>
                </>
              ) : (
                <>
                  <Database className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-amber-700">Local Cache</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/70">
                <User className="w-3.5 h-3.5 text-indigo-600" />
                <span>{currentUser}</span>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors"
                title="Switch User / Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Feed Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 flex flex-col pb-36">
        {/* Navigation Tabs and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
          {/* Feed Tabs */}
          <div className="flex p-1 bg-slate-200/70 border border-slate-200 rounded-2xl w-fit">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'all'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Globe2 className="w-4 h-4" />
              <span>Global Feed</span>
              <span className="text-xs px-2 py-0.2 bg-slate-100 rounded-full font-mono text-slate-600">
                {nonDeleted.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('my')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'my'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-4 h-4" />
              <span>My Voices</span>
            </button>

            <button
              onClick={() => setActiveTab('trash')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'trash'
                  ? 'bg-white text-rose-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              <span>Trash ({deletedRecordings.length})</span>
            </button>
          </div>

          {/* Clean Search Bar */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search creator or audio title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-2xl pl-9 pr-4 py-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
            />
          </div>
        </div>

        {/* Global Community Stream */}
        <div className="flex flex-col gap-4">
          {filtered.length === 0 ? (
            <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-white shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                <Globe2 className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-slate-800 text-base">
                {activeTab === 'trash' ? 'Trash is empty' : 'No voices shared yet'}
              </h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
                Record your voice or upload an audio file to share with everyone on the system!
              </p>
            </div>
          ) : (
            filtered.map((recording) => (
              <RecordingCard
                key={recording.id}
                recording={recording}
                isTrashView={activeTab === 'trash'}
                onRename={renameRecording}
                onSoftDelete={softDeleteRecording}
                onRestore={restoreRecording}
                onPermanentDelete={permanentlyDeleteRecording}
                onOpenMastering={(rec) => setMasteringTargetRecording(rec)}
              />
            ))
          )}
        </div>
      </main>

      {/* Floating Bottom Action Bar */}
      <div className="fixed bottom-6 left-0 right-0 px-4 pointer-events-none flex justify-center z-30">
        <div className="pointer-events-auto bg-white/95 border border-slate-200/90 backdrop-blur-xl p-2 rounded-3xl shadow-xl flex items-center gap-2">
          <button
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-all active:scale-95"
            title="Upload audio file"
          >
            <UploadCloud className="w-4 h-4 text-indigo-600" />
            <span>Upload Audio</span>
          </button>

          <button
            onClick={() => setIsRecorderOpen(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-semibold text-sm shadow-md shadow-rose-200 transition-all active:scale-95"
            title="Record & Share"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse"></span>
            <span>Record & Share</span>
          </button>
        </div>
      </div>

      {/* Modals */}
      <AudioRecorderModal
        isOpen={isRecorderOpen}
        onClose={() => setIsRecorderOpen(false)}
        username={currentUser}
        existingRecordings={recordings}
        onSave={createRecording}
      />

      <AudioUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        username={currentUser}
        existingRecordings={recordings}
        onUpload={createRecording}
      />

      <AudioMasteringModal
        isOpen={Boolean(masteringTargetRecording)}
        recording={masteringTargetRecording}
        onClose={() => setMasteringTargetRecording(null)}
        onSaveEnhanced={createRecording}
      />
    </div>
  );
}

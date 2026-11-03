import React, { useState } from 'react';
import {
  Calendar,
  User,
  HardDrive,
  Clock,
  Edit2,
  Trash2,
  RotateCcw,
  Download,
  Share2,
  Check,
  X,
  Music,
  Sparkles
} from 'lucide-react';
import AudioPlayer from './AudioPlayer';
import { formatBytes, formatDuration } from '../utils/audioUtils';

export default function RecordingCard({
  recording,
  isTrashView,
  onRename,
  onSoftDelete,
  onRestore,
  onPermanentDelete,
  onOpenMastering
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(recording.name);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const handleSaveRename = () => {
    if (editedTitle.trim()) {
      onRename(recording.id, editedTitle.trim());
      setIsEditing(false);
    }
  };

  const handleCopyLink = () => {
    if (recording.audioUrl) {
      navigator.clipboard.writeText(recording.audioUrl);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  };

  const formattedDate = recording.createdAt
    ? new Date(recording.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Unknown date';

  return (
    <div className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all duration-200">
      {/* Top Header: Author avatar, title & Actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center flex-shrink-0 text-sm shadow-sm">
            {recording.author ? recording.author.charAt(0).toUpperCase() : 'A'}
          </div>

          <div className="min-w-0">
            {isEditing ? (
              <div className="flex items-center gap-1.5 mb-1">
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="bg-slate-50 border border-indigo-500 rounded-lg px-2.5 py-1 text-sm text-slate-800 focus:outline-none"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveRename();
                    if (e.key === 'Escape') setIsEditing(false);
                  }}
                />
                <button
                  onClick={handleSaveRename}
                  className="p-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"
                  title="Save"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="p-1 rounded-lg bg-slate-100 text-slate-600"
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 text-base truncate" title={recording.name}>
                  {recording.name}
                </h3>
                {!isTrashView && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
                    title="Rename"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-400">
              <span className="font-semibold text-indigo-600">{recording.author}</span>
              <span>•</span>
              <span>{formattedDate}</span>
            </div>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!isTrashView ? (
            <>
              {/* Studio Mastering / Volume Booster Button */}
              {recording.audioUrl && onOpenMastering && (
                <button
                  onClick={() => onOpenMastering(recording)}
                  className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 shadow-xs"
                  title="Enhance & Boost Audio"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span className="hidden sm:inline">Enhance & Boost</span>
                </button>
              )}

              {recording.audioUrl && (
                <>
                  <button
                    onClick={handleCopyLink}
                    className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/80 transition-colors"
                    title={copyFeedback ? "Copied!" : "Share Link"}
                  >
                    {copyFeedback ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Share2 className="w-4 h-4" />
                    )}
                  </button>

                  <a
                    href={recording.audioUrl}
                    download={`${recording.name}.mp3`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/80 transition-colors"
                    title="Download MP3"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </>
              )}

              <button
                onClick={() => onSoftDelete(recording.id)}
                className="p-2 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200/80 transition-colors"
                title="Move to Trash"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onRestore(recording.id)}
                className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center gap-1.5 border border-indigo-200 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restore
              </button>

              <button
                onClick={() => onPermanentDelete(recording.id, recording.storagePath)}
                className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Badges Info */}
      <div className="flex flex-wrap items-center gap-2 text-xs mt-3">
        <span className="flex items-center gap-1 bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-full border border-purple-200/60 font-medium">
          <Music className="w-3 h-3 text-purple-600" />
          MP3 Audio
        </span>
        <span className="flex items-center gap-1 bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full border border-slate-200 font-medium">
          <HardDrive className="w-3 h-3 text-emerald-600" />
          {formatBytes(recording.size)}
        </span>
        {recording.duration > 0 && (
          <span className="flex items-center gap-1 bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full border border-slate-200 font-medium">
            <Clock className="w-3 h-3 text-amber-600" />
            {formatDuration(recording.duration)}
          </span>
        )}
      </div>

      {/* Audio Playback */}
      {recording.audioUrl && (
        <AudioPlayer src={recording.audioUrl} duration={recording.duration} />
      )}
    </div>
  );
}

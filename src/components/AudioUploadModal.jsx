import React, { useState, useRef } from 'react';
import { UploadCloud, FileAudio, Check, X, AlertCircle, Loader2 } from 'lucide-react';
import { formatBytes, formatDuration, generateDefaultRecordingName } from '../utils/audioUtils';
import { convertAudioBlobToMp3 } from '../utils/mp3Encoder';

export default function AudioUploadModal({ isOpen, onClose, username, existingRecordings, onUpload }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [customName, setCustomName] = useState('');
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileSelect = async (file) => {
    if (!file) return;

    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|ogg|m4a|aac|webm)$/i)) {
      setErrorMsg('Please upload a valid audio file (.mp3, .wav, .m4a, .ogg, .webm)');
      return;
    }

    setErrorMsg('');
    setSelectedFile(file);

    // Default name based on username & date convention
    const defaultName = generateDefaultRecordingName(username, existingRecordings);
    setCustomName(defaultName);

    // Create temporary URL to read duration and preview
    const tempUrl = URL.createObjectURL(file);
    setAudioUrl(tempUrl);

    // Extract duration from audio element
    const tempAudio = new Audio(tempUrl);
    tempAudio.onloadedmetadata = () => {
      if (tempAudio.duration && !isNaN(tempAudio.duration) && tempAudio.duration !== Infinity) {
        setDuration(Math.round(tempAudio.duration));
      }
    };
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const cleanup = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setSelectedFile(null);
    setAudioUrl(null);
    setCustomName('');
    setDuration(0);
    setErrorMsg('');
    setIsProcessing(false);
    onClose();
  };

  const handleSaveUpload = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setErrorMsg('');

    try {
      let finalBlob = selectedFile;

      // If uploaded file is not already MP3, encode to standard MP3
      if (selectedFile.type !== 'audio/mp3' && !selectedFile.name.endsWith('.mp3')) {
        try {
          finalBlob = await convertAudioBlobToMp3(selectedFile);
        } catch (convErr) {
          console.warn('Direct MP3 conversion failed, using original audio blob', convErr);
          finalBlob = selectedFile;
        }
      }

      await onUpload({
        audioBlob: finalBlob,
        name: customName.trim() || generateDefaultRecordingName(username, existingRecordings),
        author: username,
        duration: duration || 0,
        size: finalBlob.size,
      });

      cleanup();
    } catch (err) {
      console.error('Upload failed:', err);
      setErrorMsg('Upload failed: ' + err.message);
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 leading-tight">Upload Audio File</h2>
              <p className="text-xs text-slate-500">Supports MP3, WAV, M4A, OGG, WebM</p>
            </div>
          </div>
          <button
            onClick={cleanup}
            disabled={isProcessing}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Drop zone or File details */}
        {!selectedFile ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`mt-5 border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center ${
              dragOver
                ? 'border-indigo-500 bg-indigo-50/50 scale-[0.99]'
                : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50/60'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.webm"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
            />
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
              <FileAudio className="w-7 h-7" />
            </div>
            <p className="text-sm font-semibold text-slate-700">
              Click to select or drag & drop audio here
            </p>
            <p className="text-xs text-slate-400 mt-1">Maximum file size 50 MB</p>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {/* File info card */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
                  <FileAudio className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">{selectedFile.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {formatBytes(selectedFile.size)} • {duration > 0 ? formatDuration(duration) : 'Audio file'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedFile(null);
                  if (audioUrl) URL.revokeObjectURL(audioUrl);
                  setAudioUrl(null);
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-medium ml-2 px-2 py-1 rounded-lg hover:bg-rose-50"
              >
                Change
              </button>
            </div>

            {/* Custom name input */}
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">
                Recording Name
              </label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                placeholder="Recording name..."
              />
            </div>

            {/* Audio Preview */}
            {audioUrl && (
              <div className="pt-2">
                <audio controls src={audioUrl} className="w-full h-10 rounded-lg accent-indigo-600" />
              </div>
            )}
          </div>
        )}

        {/* Footer actions */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
          <button
            onClick={cleanup}
            disabled={isProcessing}
            className="px-4 py-2.5 rounded-xl text-slate-600 hover:text-slate-800 hover:bg-slate-100 font-medium text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveUpload}
            disabled={!selectedFile || isProcessing}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Save to Cloud</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

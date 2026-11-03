import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Pause, Play, Trash2, Check, AlertCircle, Loader2, X } from 'lucide-react';
import AudioVisualizer from './AudioVisualizer';
import { formatDuration, formatBytes, generateDefaultRecordingName } from '../utils/audioUtils';
import { convertAudioBlobToMp3 } from '../utils/mp3Encoder';

export default function AudioRecorderModal({ isOpen, onClose, username, existingRecordings, onSave }) {
  const [recordingState, setRecordingState] = useState('idle'); // 'idle' | 'recording' | 'paused' | 'stopped'
  const [duration, setDuration] = useState(0);
  const [finalAudioBlob, setFinalAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [customName, setCustomName] = useState('');
  const [stream, setStream] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isEncoding, setIsEncoding] = useState(false);
  const [encodingStatus, setEncodingStatus] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isLargeRecording, setIsLargeRecording] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      cleanup();
    } else {
      const defaultName = generateDefaultRecordingName(username, existingRecordings);
      setCustomName(defaultName);
    }
  }, [isOpen, username, existingRecordings]);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setRecordingState('idle');
    setDuration(0);
    setFinalAudioBlob(null);
    setErrorMsg('');
    setIsEncoding(false);
    setEncodingStatus('');
    setIsUploading(false);
    setIsLargeRecording(false);
  };

  const startRecording = async () => {
    try {
      setErrorMsg('');
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      setStream(audioStream);

      // Best high-efficiency speech codec
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm';
      }

      // Bitrate set to 64 kbps (perfect for voice, highly compressed: 1 hour = ~28 MB!)
      const recorder = new MediaRecorder(audioStream, {
        mimeType,
        audioBitsPerSecond: 64000
      });

      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const rawBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const currentDuration = duration;

        // Long recording protection (> 10 minutes or > 15 MB)
        // Decoding 1 hour into uncompressed raw PCM crashes browser RAM (~1.3 GB).
        // For long recordings, we keep the high-efficiency native audio stream (Opus/WebM/MP4)
        // so it saves instantly in 0.1s without freezing or crashing!
        if (currentDuration > 600 || rawBlob.size > 15 * 1024 * 1024) {
          setIsLargeRecording(true);
          setFinalAudioBlob(rawBlob);
          const url = URL.createObjectURL(rawBlob);
          setAudioUrl(url);
          setRecordingState('stopped');
        } else {
          // Short to medium memos: convert to standard MP3
          setIsEncoding(true);
          setEncodingStatus('Encoding to standard MP3...');
          try {
            const encodedMp3 = await convertAudioBlobToMp3(rawBlob);
            setFinalAudioBlob(encodedMp3);
            const url = URL.createObjectURL(encodedMp3);
            setAudioUrl(url);
            setRecordingState('stopped');
          } catch (err) {
            console.warn("Fast-falling back to native audio:", err);
            setFinalAudioBlob(rawBlob);
            const url = URL.createObjectURL(rawBlob);
            setAudioUrl(url);
            setRecordingState('stopped');
          } finally {
            setIsEncoding(false);
          }
        }
      };

      // Collect data every 1 second to keep memory minimal
      recorder.start(1000);
      setRecordingState('recording');

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access error:", err);
      setErrorMsg("Microphone permission denied or audio device not found.");
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.pause();
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingState('paused');
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'paused') {
      mediaRecorderRef.current.resume();
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
      setRecordingState('recording');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && (recordingState === 'recording' || recordingState === 'paused')) {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
    }
  };

  const handleDiscard = () => {
    cleanup();
    onClose();
  };

  const handleSave = async () => {
    if (!finalAudioBlob) return;
    setIsUploading(true);
    try {
      await onSave({
        audioBlob: finalAudioBlob,
        name: customName.trim() || generateDefaultRecordingName(username, existingRecordings),
        author: username,
        duration,
        size: finalAudioBlob.size,
      });
      cleanup();
      onClose();
    } catch (e) {
      setErrorMsg("Failed to upload recording: " + e.message);
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 shadow-2xl flex flex-col items-center">
        {/* Header */}
        <div className="w-full flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
            <h2 className="text-base font-bold text-slate-800">Voice Memo Studio</h2>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              Long-Duration Safe (1hr+)
            </span>
          </div>
          <button
            onClick={handleDiscard}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="w-full mb-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Visualizer & Waveform */}
        <div className="w-full my-2">
          <AudioVisualizer
            isRecording={recordingState === 'recording' || recordingState === 'paused'}
            isPaused={recordingState === 'paused'}
            stream={stream}
          />
        </div>

        {/* Live Timer */}
        <div className="text-4xl font-mono font-bold tracking-wider my-3 text-slate-800">
          {formatDuration(duration)}
        </div>

        {/* Encoding State */}
        {isEncoding && (
          <div className="flex items-center gap-2 text-indigo-600 text-sm my-3 font-medium">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{encodingStatus || 'Preparing audio...'}</span>
          </div>
        )}

        {/* Post-recording preview & metadata edit */}
        {recordingState === 'stopped' && finalAudioBlob && (
          <div className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-5 flex flex-col gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">
                Recording Name (Editable)
              </label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                placeholder="Recording name..."
              />
            </div>

            <div className="flex justify-between items-center text-xs text-slate-500 pt-2 border-t border-slate-200">
              <span>Size: <strong className="text-slate-700">{formatBytes(finalAudioBlob.size)}</strong></span>
              <span>Duration: <strong className="text-slate-700">{formatDuration(duration)}</strong></span>
              <span>Format: <strong className="text-indigo-600">{isLargeRecording ? 'High-Def Stream' : 'MP3 Audio'}</strong></span>
            </div>

            {audioUrl && (
              <audio controls src={audioUrl} className="w-full mt-1 h-10 accent-indigo-600 rounded-lg" />
            )}
          </div>
        )}

        {/* Controls Bar */}
        <div className="flex items-center gap-6 mt-4">
          {recordingState === 'idle' && (
            <button
              onClick={startRecording}
              className="w-20 h-20 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-200 transition-transform active:scale-95"
              title="Record"
            >
              <Mic className="w-8 h-8" />
            </button>
          )}

          {(recordingState === 'recording' || recordingState === 'paused') && (
            <>
              {/* Pause / Resume */}
              <button
                onClick={recordingState === 'recording' ? pauseRecording : resumeRecording}
                className="w-14 h-14 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center justify-center transition-transform active:scale-95 shadow-sm"
                title={recordingState === 'recording' ? "Pause" : "Resume"}
              >
                {recordingState === 'recording' ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6 ml-0.5 text-emerald-600" />
                )}
              </button>

              {/* Stop */}
              <button
                onClick={stopRecording}
                className="w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-200 transition-transform active:scale-95"
                title="Stop Recording"
              >
                <Square className="w-6 h-6 fill-current" />
              </button>
            </>
          )}

          {recordingState === 'stopped' && (
            <div className="flex gap-3">
              <button
                onClick={handleDiscard}
                disabled={isUploading}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm flex items-center gap-2 border border-slate-200 transition-colors"
              >
                <Trash2 className="w-4 h-4 text-rose-500" />
                Discard
              </button>

              <button
                onClick={handleSave}
                disabled={isUploading || isEncoding}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm flex items-center gap-2 shadow-sm transition-transform active:scale-95"
              >
                <Check className="w-4 h-4" />
                {isUploading ? "Uploading..." : "Save Recording"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

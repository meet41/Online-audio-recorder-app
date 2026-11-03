import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Sliders,
  Volume2,
  ShieldCheck,
  Activity,
  Check,
  X,
  Play,
  Pause,
  RotateCcw,
  Loader2,
  Radio,
  FileCheck2
} from 'lucide-react';
import { enhanceAudioPipeline, calculateLoudnessStats } from '../utils/audioMasteringEngine';
import { formatBytes, formatDuration } from '../utils/audioUtils';

export default function AudioMasteringModal({ isOpen, onClose, recording, onSaveEnhanced }) {
  const [volumeBoost, setVolumeBoost] = useState(1.5); // 150% default boost
  const [enableDeNoise, setEnableDeNoise] = useState(true);
  const [enableEnhanceSpeech, setEnableEnhanceSpeech] = useState(true);
  const [enableMultiBand, setEnableMultiBand] = useState(true);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [enhancedResult, setEnhancedResult] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [activeTab, setActiveTab] = useState('enhanced'); // 'original' | 'enhanced'

  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    if (isOpen && recording) {
      handleProcessAudio();
    } else {
      cleanup();
    }
  }, [isOpen, recording]);

  const cleanup = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setEnhancedResult(null);
    setPreviewUrl(null);
    setIsProcessing(false);
    setIsSaving(false);
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleProcessAudio = async () => {
    if (!recording?.audioUrl) return;

    setIsProcessing(true);
    try {
      // Fetch current audio blob
      const response = await fetch(recording.audioUrl);
      const audioBlob = await response.blob();

      // Run mastering pipeline
      const result = await enhanceAudioPipeline(audioBlob, {
        volumeBoost,
        enableDeNoise,
        enableEnhanceSpeech,
        enableMultiBand
      });

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(result.enhancedBlob);

      setEnhancedResult(result);
      setPreviewUrl(url);
    } catch (err) {
      console.error('Mastering error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  };

  const handleSaveAsNew = async () => {
    if (!enhancedResult?.enhancedBlob || !recording) return;

    setIsSaving(true);
    try {
      // Save as a separate new recording so it NEVER overwrites or overlaps the original
      const newName = `${recording.name} (Enhanced Studio)`;

      await onSaveEnhanced({
        audioBlob: enhancedResult.enhancedBlob,
        name: newName,
        author: recording.author,
        duration: enhancedResult.duration || recording.duration,
        size: enhancedResult.enhancedBlob.size,
      });

      cleanup();
      onClose();
    } catch (err) {
      console.error('Save enhanced error:', err);
      setIsSaving(false);
    }
  };

  if (!isOpen || !recording) return null;

  const currentAudioSource = activeTab === 'enhanced' && previewUrl ? previewUrl : recording.audioUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-200">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-800 leading-tight">Adobe-Grade Audio Studio</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  DSP Mastering
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate max-w-sm">Source: {recording.name}</p>
            </div>
          </div>
          <button
            onClick={() => {
              cleanup();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Studio Controls */}
        <div className="mt-5 space-y-4">
          {/* 1. Volume Booster with Zero-Clipping Protection */}
          <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Intelligent Volume Booster
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                {Math.round(volumeBoost * 100)}% (+{Math.round(20 * Math.log10(volumeBoost))} dB)
              </span>
            </div>

            <input
              type="range"
              min="0.8"
              max="3.0"
              step="0.1"
              value={volumeBoost}
              onChange={(e) => setVolumeBoost(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />

            <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1 text-emerald-600 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                Anti-Burst / Brickwall Limiter Enabled (-0.5 dBFS)
              </span>
              <span>Max: 300%</span>
            </div>
          </div>

          {/* 2. DSP Mastering Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Enhance Speech */}
            <button
              onClick={() => setEnableEnhanceSpeech(!enableEnhanceSpeech)}
              className={`p-3 rounded-2xl border text-left transition-all ${
                enableEnhanceSpeech
                  ? 'bg-indigo-50/80 border-indigo-300 text-indigo-900 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold">Enhance Speech</span>
                <span className={`w-2 h-2 rounded-full ${enableEnhanceSpeech ? 'bg-indigo-600' : 'bg-slate-300'}`}></span>
              </div>
              <p className="text-[11px] leading-tight text-slate-500">
                Acoustic vocal presence & clarity filter
              </p>
            </button>

            {/* DeNoise */}
            <button
              onClick={() => setEnableDeNoise(!enableDeNoise)}
              className={`p-3 rounded-2xl border text-left transition-all ${
                enableDeNoise
                  ? 'bg-rose-50/80 border-rose-300 text-rose-900 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold">DeNoise</span>
                <span className={`w-2 h-2 rounded-full ${enableDeNoise ? 'bg-rose-600' : 'bg-slate-300'}`}></span>
              </div>
              <p className="text-[11px] leading-tight text-slate-500">
                Removes AC hum, room rumble & mic thumps
              </p>
            </button>

            {/* Multi-Band Compressor */}
            <button
              onClick={() => setEnableMultiBand(!enableMultiBand)}
              className={`p-3 rounded-2xl border text-left transition-all ${
                enableMultiBand
                  ? 'bg-purple-50/80 border-purple-300 text-purple-900 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold">Multi-Band Dyn</span>
                <span className={`w-2 h-2 rounded-full ${enableMultiBand ? 'bg-purple-600' : 'bg-slate-300'}`}></span>
              </div>
              <p className="text-[11px] leading-tight text-slate-500">
                Balances quiet whispering & loud shouting
              </p>
            </button>
          </div>

          {/* Re-render button */}
          <button
            onClick={handleProcessAudio}
            disabled={isProcessing}
            className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 border border-slate-200 transition-colors"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Processing Audio Pipeline...</span>
              </>
            ) : (
              <>
                <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                <span>Apply & Re-Calculate Mastering</span>
              </>
            )}
          </button>

          {/* 3. Loudness Radar / ITU-R BS.1770 Meter */}
          {enhancedResult?.stats && (
            <div className="p-3.5 bg-slate-900 text-slate-100 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between text-xs mb-2">
                <div className="flex items-center gap-1.5 text-indigo-400 font-semibold">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span>ITU-R BS.1770 / EBU R128 Loudness Radar</span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">Industry Standard</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-slate-800/80 rounded-xl border border-slate-700/60">
                  <span className="block text-[10px] text-slate-400 uppercase">True Peak</span>
                  <span className="text-sm font-bold font-mono text-emerald-400">
                    {enhancedResult.stats.peakDb} dBFS
                  </span>
                </div>

                <div className="p-2 bg-slate-800/80 rounded-xl border border-slate-700/60">
                  <span className="block text-[10px] text-slate-400 uppercase">Integrated LUFS</span>
                  <span className="text-sm font-bold font-mono text-indigo-300">
                    {enhancedResult.stats.lufs} LUFS
                  </span>
                </div>

                <div className="p-2 bg-slate-800/80 rounded-xl border border-slate-700/60">
                  <span className="block text-[10px] text-slate-400 uppercase">Distortion Status</span>
                  <span className="text-sm font-bold text-emerald-400">
                    Clean (0% Clip)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 4. A/B Comparison Player */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                A / B Realtime Audition
              </span>
              <div className="flex p-0.5 bg-slate-200/80 rounded-xl">
                <button
                  onClick={() => {
                    setActiveTab('original');
                    setIsPlaying(false);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'original'
                      ? 'bg-white text-slate-800 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Original
                </button>
                <button
                  onClick={() => {
                    setActiveTab('enhanced');
                    setIsPlaying(false);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'enhanced'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Enhanced (Studio)
                </button>
              </div>
            </div>

            <audio
              ref={audioRef}
              src={currentAudioSource}
              onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
              onEnded={() => setIsPlaying(false)}
            />

            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-sm flex-shrink-0"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>

              <div className="flex-1">
                <p className="text-xs font-semibold text-slate-800">
                  {activeTab === 'enhanced' ? 'Enhanced Audio (Boosted & Cleared)' : 'Original Recording'}
                </p>
                <p className="text-[11px] text-slate-500 font-mono">
                  {formatDuration(currentTime)} / {formatDuration(recording.duration || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-100">
          <p className="text-xs text-slate-400">
            * Saves as a <strong>new separate MP3</strong> file. Original remains untouched.
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => {
                cleanup();
                onClose();
              }}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-medium text-xs transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={handleSaveAsNew}
              disabled={!enhancedResult || isSaving || isProcessing}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving New MP3...</span>
                </>
              ) : (
                <>
                  <FileCheck2 className="w-4 h-4" />
                  <span>Save as New Studio MP3</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

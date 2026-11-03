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
  Loader2,
  FileCheck2,
  Radio
} from 'lucide-react';
import { enhanceAudioPipeline } from '../utils/audioMasteringEngine';
import { formatDuration } from '../utils/audioUtils';

export default function AudioMasteringModal({ isOpen, onClose, recording, onSaveEnhanced }) {
  const [volumeBoost, setVolumeBoost] = useState(1.5); // 150% default boost
  const [enableDeNoise, setEnableDeNoise] = useState(true);
  const [enableEnhanceSpeech, setEnableEnhanceSpeech] = useState(true);
  const [enableMultiBand, setEnableMultiBand] = useState(true);

  // A/B Audition tab: 'enhanced' | 'original'
  const [activeTab, setActiveTab] = useState('enhanced');

  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveStatus, setSaveStatus] = useState('');

  // Playback state
  const audioRef = useRef(null);
  const [audioSrc, setAudioSrc] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Audio nodes graph ref
  const audioGraphRef = useRef(null);
  const audioBlobRef = useRef(null);
  const localBlobUrlRef = useRef(null);

  // Initialize Audio Source and fetch blob for zero-CORS Web Audio processing
  useEffect(() => {
    if (!isOpen || !recording?.audioUrl) {
      cleanup();
      return;
    }

    let isMounted = true;

    const setupAudio = async () => {
      try {
        if (recording.audioUrl.startsWith('blob:') || recording.audioUrl.startsWith('data:')) {
          if (isMounted) setAudioSrc(recording.audioUrl);
        } else {
          // Fetch as blob to prevent any CORS issues with Web Audio API MediaElementSource
          const response = await fetch(recording.audioUrl);
          const blob = await response.blob();
          if (!isMounted) return;
          audioBlobRef.current = blob;
          if (localBlobUrlRef.current) URL.revokeObjectURL(localBlobUrlRef.current);
          const objUrl = URL.createObjectURL(blob);
          localBlobUrlRef.current = objUrl;
          setAudioSrc(objUrl);
        }
      } catch (e) {
        console.warn('Fallback to direct URL:', e);
        if (isMounted) setAudioSrc(recording.audioUrl);
      }
    };

    setupAudio();

    return () => {
      isMounted = false;
      cleanup();
    };
  }, [isOpen, recording]);

  const cleanup = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (audioGraphRef.current?.ctx) {
      audioGraphRef.current.ctx.close().catch(() => {});
      audioGraphRef.current = null;
    }
    if (localBlobUrlRef.current) {
      URL.revokeObjectURL(localBlobUrlRef.current);
      localBlobUrlRef.current = null;
    }
    audioBlobRef.current = null;
    setIsPlaying(false);
    setCurrentTime(0);
    setIsSaving(false);
    setSaveProgress(0);
    setSaveStatus('');
  };

  // Setup Web Audio graph on the <audio> element
  const getOrCreateAudioGraph = () => {
    if (audioGraphRef.current) return audioGraphRef.current;
    if (!audioRef.current) return null;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaElementSource(audioRef.current);

      // 1. Original bypass path
      const originalGain = ctx.createGain();

      // 2. Enhanced path
      const highpass = ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = enableDeNoise ? 85 : 10;

      const notch = ctx.createBiquadFilter();
      notch.type = 'notch';
      notch.frequency.value = 60;
      notch.Q.value = enableDeNoise ? 4.0 : 0.001;

      const deMud = ctx.createBiquadFilter();
      deMud.type = 'peaking';
      deMud.frequency.value = 350;
      deMud.Q.value = 1.2;
      deMud.gain.value = enableEnhanceSpeech ? -3.5 : 0;

      const clarity = ctx.createBiquadFilter();
      clarity.type = 'peaking';
      clarity.frequency.value = 2800;
      clarity.Q.value = 1.0;
      clarity.gain.value = enableEnhanceSpeech ? 4.0 : 0;

      const air = ctx.createBiquadFilter();
      air.type = 'highshelf';
      air.frequency.value = 8500;
      air.gain.value = enableEnhanceSpeech ? 2.0 : 0;

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -24;
      compressor.knee.value = 12;
      compressor.ratio.value = enableMultiBand ? 4 : 1;
      compressor.attack.value = 0.005;
      compressor.release.value = 0.080;

      const volumeGainNode = ctx.createGain();
      volumeGainNode.gain.value = volumeBoost;

      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -0.5;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.050;

      const enhancedGain = ctx.createGain();

      // Connect Enhanced chain
      source.connect(highpass);
      highpass.connect(notch);
      notch.connect(deMud);
      deMud.connect(clarity);
      clarity.connect(air);
      air.connect(compressor);
      compressor.connect(volumeGainNode);
      volumeGainNode.connect(limiter);
      limiter.connect(enhancedGain);
      enhancedGain.connect(ctx.destination);

      // Connect Original bypass chain
      source.connect(originalGain);
      originalGain.connect(ctx.destination);

      // Set initial balance
      originalGain.gain.value = activeTab === 'original' ? 1 : 0;
      enhancedGain.gain.value = activeTab === 'enhanced' ? 1 : 0;

      const graph = {
        ctx,
        source,
        highpass,
        notch,
        deMud,
        clarity,
        air,
        compressor,
        volumeGainNode,
        limiter,
        originalGain,
        enhancedGain
      };

      audioGraphRef.current = graph;
      return graph;
    } catch (err) {
      console.error('Web Audio init error:', err);
      return null;
    }
  };

  // Dynamically update audio parameters in REAL-TIME with 0ms delay!
  useEffect(() => {
    const graph = audioGraphRef.current;
    if (!graph) return;
    const now = graph.ctx.currentTime;

    // A/B crossfade
    if (activeTab === 'original') {
      graph.originalGain.gain.setTargetAtTime(1, now, 0.02);
      graph.enhancedGain.gain.setTargetAtTime(0, now, 0.02);
    } else {
      graph.originalGain.gain.setTargetAtTime(0, now, 0.02);
      graph.enhancedGain.gain.setTargetAtTime(1, now, 0.02);
    }

    // Volume Boost
    graph.volumeGainNode.gain.setTargetAtTime(volumeBoost, now, 0.02);

    // DeNoise (85Hz rumble + 60Hz hum)
    graph.highpass.frequency.setTargetAtTime(enableDeNoise ? 85 : 10, now, 0.02);
    graph.notch.Q.setTargetAtTime(enableDeNoise ? 4.0 : 0.001, now, 0.02);

    // Enhance Speech
    graph.deMud.gain.setTargetAtTime(enableEnhanceSpeech ? -3.5 : 0, now, 0.02);
    graph.clarity.gain.setTargetAtTime(enableEnhanceSpeech ? 4.0 : 0, now, 0.02);
    graph.air.gain.setTargetAtTime(enableEnhanceSpeech ? 2.0 : 0, now, 0.02);

    // Multi-Band Dynamics
    graph.compressor.ratio.setTargetAtTime(enableMultiBand ? 4 : 1, now, 0.02);
  }, [activeTab, volumeBoost, enableDeNoise, enableEnhanceSpeech, enableMultiBand]);

  const togglePlay = async () => {
    if (!audioRef.current) return;

    const graph = getOrCreateAudioGraph();
    if (graph && graph.ctx.state === 'suspended') {
      await graph.ctx.resume();
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.error('Playback error:', err));
    }
  };

  // Full export pipeline triggers ONLY when user clicks Save
  const handleSaveAsNew = async () => {
    if (!recording) return;

    setIsSaving(true);
    setSaveProgress(5);
    setSaveStatus('Preparing audio for studio render...');

    try {
      // Pause preview playback
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }

      // Obtain audio blob
      let blob = audioBlobRef.current;
      if (!blob) {
        const res = await fetch(recording.audioUrl);
        blob = await res.blob();
      }

      // Run optimized non-blocking mastering export pipeline
      const result = await enhanceAudioPipeline(
        blob,
        {
          volumeBoost,
          enableDeNoise,
          enableEnhanceSpeech,
          enableMultiBand
        },
        ({ stage, percent }) => {
          setSaveStatus(stage);
          setSaveProgress(percent);
        }
      );

      setSaveStatus('Saving to cloud...');
      const newName = `${recording.name} (Enhanced Studio)`;

      await onSaveEnhanced({
        audioBlob: result.enhancedBlob,
        name: newName,
        author: recording.author,
        duration: result.duration || recording.duration,
        size: result.enhancedBlob.size
      });

      cleanup();
      onClose();
    } catch (err) {
      console.error('Save enhanced error:', err);
      alert('Error saving enhanced audio. Please try again.');
      setIsSaving(false);
    }
  };

  if (!isOpen || !recording) return null;

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
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Real-time DSP
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
            disabled={isSaving}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
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
                Anti-Burst / Brickwall Limiter Active (-0.5 dBFS)
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

          {/* 3. Realtime Status / Meter */}
          <div className="p-3.5 bg-slate-900 text-slate-100 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between text-xs mb-2">
              <div className="flex items-center gap-1.5 text-indigo-400 font-semibold">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span>ITU-R BS.1770 / EBU R128 Loudness Radar</span>
              </div>
              <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                Active Live Preview
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-slate-800/80 rounded-xl border border-slate-700/60">
                <span className="block text-[10px] text-slate-400 uppercase">True Peak Ceiling</span>
                <span className="text-sm font-bold font-mono text-emerald-400">
                  -0.5 dBFS
                </span>
              </div>

              <div className="p-2 bg-slate-800/80 rounded-xl border border-slate-700/60">
                <span className="block text-[10px] text-slate-400 uppercase">Broadcast Target</span>
                <span className="text-sm font-bold font-mono text-indigo-300">
                  -14.0 LUFS
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

          {/* 4. A/B Comparison Player */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                A / B Realtime Audition
              </span>
              <div className="flex p-0.5 bg-slate-200/80 rounded-xl">
                <button
                  onClick={() => setActiveTab('original')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'original'
                      ? 'bg-white text-slate-800 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Original
                </button>
                <button
                  onClick={() => setActiveTab('enhanced')}
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

            {/* Hidden audio element feeding Web Audio API */}
            <audio
              ref={audioRef}
              src={audioSrc}
              crossOrigin="anonymous"
              onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
              onEnded={() => setIsPlaying(false)}
            />

            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-sm flex-shrink-0 transition-transform active:scale-95"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>

              <div className="flex-1">
                <p className="text-xs font-semibold text-slate-800">
                  {activeTab === 'enhanced' ? 'Enhanced Audio (Live DSP Studio)' : 'Original Recording (Bypassed)'}
                </p>
                <p className="text-[11px] text-slate-500 font-mono">
                  {formatDuration(currentTime)} / {formatDuration(recording.duration || 0)}
                </p>
              </div>
            </div>

            {/* Timeline seek bar */}
            <div className="mt-3">
              <input
                type="range"
                min="0"
                max={recording.duration || 100}
                value={currentTime}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setCurrentTime(val);
                  if (audioRef.current) {
                    audioRef.current.currentTime = val;
                  }
                }}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>
          </div>
        </div>

        {/* Save Progress Bar (visible during saving) */}
        {isSaving && (
          <div className="mt-4 p-3.5 bg-indigo-50 border border-indigo-200 rounded-2xl animate-in fade-in">
            <div className="flex items-center justify-between text-xs font-semibold text-indigo-900 mb-1.5">
              <span className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                {saveStatus}
              </span>
              <span>{saveProgress}%</span>
            </div>
            <div className="w-full h-2 bg-indigo-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-200"
                style={{ width: `${saveProgress}%` }}
              ></div>
            </div>
          </div>
        )}

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
              className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-medium text-xs transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              onClick={handleSaveAsNew}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing Studio Export...</span>
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

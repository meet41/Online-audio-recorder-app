import React, { useEffect, useRef } from 'react';

export default function AudioVisualizer({ isRecording, isPaused, stream }) {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);

  useEffect(() => {
    if (!stream || !isRecording) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
      return;
    }

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      sourceRef.current = source;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');

      const draw = () => {
        if (!isRecording) return;
        animationFrameRef.current = requestAnimationFrame(draw);

        if (isPaused) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const barWidth = 4;
          const gap = 3;
          const numBars = Math.floor(canvas.width / (barWidth + gap));
          ctx.fillStyle = '#94a3b8';
          for (let i = 0; i < numBars; i++) {
            const x = i * (barWidth + gap);
            ctx.fillRect(x, canvas.height / 2 - 2, barWidth, 4);
          }
          return;
        }

        analyser.getByteFrequencyData(dataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const barWidth = 4;
        const gap = 3;
        const totalBars = Math.floor(canvas.width / (barWidth + gap));

        for (let i = 0; i < totalBars; i++) {
          const dataIndex = Math.floor((i / totalBars) * bufferLength);
          const value = dataArray[dataIndex] || 0;
          const percent = value / 255;
          const barHeight = Math.max(4, percent * canvas.height * 0.9);

          const x = i * (barWidth + gap);
          const y = (canvas.height - barHeight) / 2;

          // Gradient color: vivid rose to indigo
          const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
          gradient.addColorStop(0, '#f43f5e');
          gradient.addColorStop(1, '#6366f1');

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, 2);
          ctx.fill();
        }
      };

      draw();
    } catch (e) {
      console.error("Audio visualizer initialization error", e);
    }

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [isRecording, isPaused, stream]);

  return (
    <div className="w-full flex items-center justify-center h-16 bg-slate-100/90 rounded-2xl px-4 border border-slate-200 shadow-inner">
      <canvas
        ref={canvasRef}
        width={340}
        height={60}
        className="w-full h-full max-w-sm"
      />
    </div>
  );
}

import { Mp3Encoder } from '@breezystack/lamejs';

/**
 * Converts a recorded audio Blob (e.g. webm/ogg/wav from MediaRecorder or AudioBuffer)
 * to a genuine, standard MP3 Blob directly in the browser.
 *
 * @param {Blob} webmBlob
 * @returns {Promise<Blob>} mp3Blob
 */
export async function convertAudioBlobToMp3(audioBlob) {
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const channels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const mp3encoder = new Mp3Encoder(channels, sampleRate, 128); // 128 kbps high quality

    const mp3Data = [];
    const sampleBlockSize = 1152; // samples per MP3 frame

    // Prepare channel samples as 16-bit signed PCM integers
    const leftData = audioBuffer.getChannelData(0);
    const rightData = channels > 1 ? audioBuffer.getChannelData(1) : leftData;

    const leftInt16 = convertFloat32ToInt16(leftData);
    const rightInt16 = channels > 1 ? convertFloat32ToInt16(rightData) : leftInt16;

    const length = leftInt16.length;
    for (let i = 0; i < length; i += sampleBlockSize) {
      const leftChunk = leftInt16.subarray(i, i + sampleBlockSize);
      const rightChunk = channels > 1 ? rightInt16.subarray(i, i + sampleBlockSize) : leftChunk;

      const mp3buf = channels === 1
        ? mp3encoder.encodeBuffer(leftChunk)
        : mp3encoder.encodeBuffer(leftChunk, rightChunk);

      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }
    }

    const endBuf = mp3encoder.flush();
    if (endBuf.length > 0) {
      mp3Data.push(endBuf);
    }

    return new Blob(mp3Data, { type: 'audio/mp3' });
  } finally {
    if (audioCtx.state !== 'closed') {
      audioCtx.close().catch(() => {});
    }
  }
}

function convertFloat32ToInt16(float32Array) {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16Array;
}

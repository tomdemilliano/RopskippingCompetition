/**
 * pcmToWav.js — SkipFlow
 *
 * Zet ruwe PCM-audio (zoals Gemini TTS teruggeeft) om in een afspeelbare
 * WAV-Blob door er een 44-byte RIFF/WAVE-header voor te plakken. Puur — geen
 * React, geen Firestore (CLAUDE.md). Port van de `pcmToWav`-functie uit de
 * oorspronkelijke Google Apps Script sidebar.html, veralgemeend naar
 * instelbare sample rate/kanalen/bitdiepte in plaats van vast 16-bit mono.
 *
 * Zie "Aankondigingen (TTS)" in ARCHITECTURE.md.
 */

/**
 * @param {Uint8Array|ArrayBuffer} pcmBytes  ruwe PCM-samples (little-endian)
 * @param {Object} [options]
 * @param {number} [options.sampleRate=24000]
 * @param {number} [options.numChannels=1]
 * @param {number} [options.bitsPerSample=16]
 * @returns {Blob} afspeelbare WAV-blob (`audio/wav`)
 */
export function pcmToWav(pcmBytes, { sampleRate = 24000, numChannels = 1, bitsPerSample = 16 } = {}) {
  const pcm = pcmBytes instanceof Uint8Array ? pcmBytes : new Uint8Array(pcmBytes);
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm.length;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  let offset = 0;
  function writeString(s) {
    for (let i = 0; i < s.length; i++) {
      view.setUint8(offset + i, s.charCodeAt(i));
    }
    offset += s.length;
  }

  // Riff chunk
  writeString('RIFF');
  view.setUint32(offset, 36 + dataSize, true); offset += 4;
  writeString('WAVE');

  // Fmt chunk
  writeString('fmt ');
  view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint16(offset, numChannels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, byteRate, true); offset += 4;
  view.setUint16(offset, blockAlign, true); offset += 2;
  view.setUint16(offset, bitsPerSample, true); offset += 2;

  // Data chunk
  writeString('data');
  view.setUint32(offset, dataSize, true); offset += 4;

  for (let i = 0; i < pcm.length; i++) {
    view.setUint8(offset++, pcm[i]);
  }

  return new Blob([view], { type: 'audio/wav' });
}

/**
 * Decodeert een base64-string (zoals Gemini's `inlineData.data`) naar ruwe
 * bytes, voor gebruik als `pcmBytes`-argument van {@link pcmToWav}.
 * @param {string} base64
 * @returns {Uint8Array}
 */
export function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

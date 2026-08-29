// PCM helpers for voice-list mode (2026-06-11). The ElevenLabs TTS endpoint
// returns base64 PCM16 mono @24kHz; while the avatar session is STOPPED there
// is no repeatAudio() sink, so we play it straight through WebAudio.

/** Pure: little-endian PCM16 bytes -> Float32 samples in [-1, 1]. */
export function pcm16BytesToFloat32(bytes: Uint8Array): Float32Array {
  const sampleCount = Math.floor(bytes.length / 2);
  const out = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const lo = bytes[i * 2];
    const hi = bytes[i * 2 + 1];
    let v = (hi << 8) | lo;
    if (v >= 0x8000) v -= 0x10000;
    out[i] = v / 32768;
  }
  return out;
}

export const ELEVENLABS_PCM_SAMPLE_RATE = 24000;

/** Browser: base64 PCM16 -> AudioBuffer ready to play. */
export function pcm16Base64ToAudioBuffer(
  ctx: AudioContext,
  base64: string,
): AudioBuffer {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const samples = pcm16BytesToFloat32(bytes);
  const buffer = ctx.createBuffer(1, Math.max(1, samples.length), ELEVENLABS_PCM_SAMPLE_RATE);
  buffer.getChannelData(0).set(samples);
  return buffer;
}

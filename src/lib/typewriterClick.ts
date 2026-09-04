/**
 * Synthesized old-fashioned typewriter key click.
 *
 * G, ride 2026-09-04 12:43:57, looking at his own capture box:
 *   "And where are the typewriter sounds? ... the letters should come up one
 *    at a time with a, like, a clicking of a typewriter sound. Just like on
 *    the WildWorks avatar in iScott."
 *
 * The sound and the letter-by-letter reveal already existed (built 2026-06-01)
 * but were wired only to the OLDER on-chest email box. The box G actually sees
 * now is ContactStatusCard, which painted the whole address at once. This
 * module is the click, lifted out so the card can use it without touching the
 * working chest path.
 *
 * It is an independent UI sound: never routed through 6's TTS, never allowed to
 * block or break the reveal, and every failure is swallowed. `seed` (a char
 * code + index) gives per-letter variety so repeated letters differ slightly.
 */

let ctxRef: AudioContext | null = null;

/** Release the shared context. Call on unmount of the last consumer. */
export function closeTypewriterAudio(): void {
  const ctx = ctxRef;
  ctxRef = null;
  if (!ctx) return;
  // close() REJECTS on an already-closed context rather than throwing, so a
  // try/catch here would catch nothing and the rejection would surface as
  // "Cannot close a closed AudioContext." in the client error log.
  void ctx.close().catch(() => {});
}

export function playTypewriterClick(seed: number): void {
  if (typeof window === "undefined") return;
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    if (!ctxRef) ctxRef = new Ctor();
    const ctx = ctxRef;
    if (!ctx) return;
    if (ctx.state === "suspended") {
      // Autoplay policy may suspend the context; try to resume but never block.
      void ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;
    const jitter = ((seed % 7) - 3) / 100 + ((now * 1000) % 9) / 1000;
    const gainScale = 0.8 + (seed % 5) / 12; // ~0.8..1.2

    // 1) Short filtered white-noise burst = the key thunk (~22ms).
    const noiseDur = 0.022;
    const frameCount = Math.max(1, Math.floor(ctx.sampleRate * noiseDur));
    const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i += 1) {
      const v = Math.sin((i + seed) * 12.9898) * 43758.5453;
      data[i] = (v - Math.floor(v)) * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 2300 + (seed % 11) * 70;
    noiseFilter.Q.value = 0.9;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.5 * gainScale, now + 0.001);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + noiseDur);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + noiseDur);

    // 2) Very short high "ping" = the typebar snap (~10ms).
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = 2600 + jitter * 1200 + (seed % 9) * 40;
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.0001, now);
    oscGain.gain.exponentialRampToValueAtTime(0.12 * gainScale, now + 0.001);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.01);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.012);
  } catch {
    // Audio must never break the reveal.
  }
}

/**
 * Per-character delay. G, 2026-06-09, on the chest reveal: he wants each letter
 * to land as he SAYS it, and to hear the click on every key. ~40ms read as too
 * quick to follow his voice; ~95ms with charcode jitter is a clear clack per
 * letter. Same numbers here so both boxes feel identical.
 */
export function typewriterDelayMs(ch: string): number {
  return 95 + (ch.charCodeAt(0) % 16);
}

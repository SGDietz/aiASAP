export const API_KEY = process.env.LIVEAVATAR_API_KEY || "";
export const API_URL = process.env.LIVEAVATAR_API_URL || "https://api.liveavatar.com";
export const AVATAR_ID = process.env.LIVEAVATAR_AVATAR_ID || "";

// FULL MODE Customizations
// Wayne's avatar voice and context
export const VOICE_ID = process.env.LIVEAVATAR_VOICE_ID || "";
export const FALLBACK_VOICE_ID =
  process.env.LIVEAVATAR_FALLBACK_VOICE_ID || "c2527536-6d1f-4412-a643-53a3497dada9";
// REMOVED 2026-08-21 (G: "aiASAP must ultimately have NO LiveAvatar context
// window. LiveAvatar should receive no aiASAP context ID."). 6's brain lives in
// the codebase — tools/cw_6af8624c_prompt.txt -> src/lib/brain/sixSystemPrompt.ts
// -> app/api/openai-chat-complete/route.ts — with no character cap. Nothing may
// send a context_id to LiveAvatar again; re-adding this export would quietly
// reintroduce the provider's 65,535-char ceiling on 6's brain.
// export const CONTEXT_ID = process.env.LIVEAVATAR_CONTEXT_ID || "";
export const LANGUAGE = process.env.LIVEAVATAR_LANGUAGE || "";

// CUSTOM MODE Customizations
export const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";
export const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "";
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

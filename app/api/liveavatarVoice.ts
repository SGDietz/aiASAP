import { API_KEY, API_URL, FALLBACK_VOICE_ID, VOICE_ID } from "./secrets";

const PREVIEW_CACHE_TTL_MS = 5 * 60 * 1000;
const PREVIEW_TIMEOUT_MS = 4_500;

type VoicePreviewStatus = {
  checkedAt: number;
  hasAudio: boolean | null;
  status?: number;
  error?: string;
};

export type LiveAvatarVoiceResolution = {
  voiceId: string;
  primaryVoiceId: string;
  fallbackVoiceId: string;
  usedFallback: boolean;
  reason: string;
};

const previewCache = new Map<string, VoicePreviewStatus>();

function apiUrl(path: string) {
  return `${API_URL.replace(/\/+$/, "")}${path}`;
}

function previewAudioLength(data: unknown): number {
  if (!data || typeof data !== "object") return 0;
  const root = data as Record<string, unknown>;
  const direct = root.audio_base64;
  if (typeof direct === "string") return direct.length;
  const nested = root.data;
  if (!nested || typeof nested !== "object") return 0;
  const audio = (nested as Record<string, unknown>).audio_base64;
  return typeof audio === "string" ? audio.length : 0;
}

async function getVoicePreviewStatus(voiceId: string): Promise<VoicePreviewStatus> {
  const cached = previewCache.get(voiceId);
  const now = Date.now();
  if (cached && now - cached.checkedAt < PREVIEW_CACHE_TTL_MS) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PREVIEW_TIMEOUT_MS);
  try {
    const res = await fetch(apiUrl(`/v1/voices/${voiceId}/preview`), {
      headers: { "X-API-KEY": API_KEY },
      signal: controller.signal,
      cache: "no-store",
    });
    const raw = await res.text();
    let data: unknown = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = null;
    }
    const status: VoicePreviewStatus = {
      checkedAt: now,
      hasAudio: res.ok ? previewAudioLength(data) > 0 : null,
      status: res.status,
      error: res.ok ? undefined : raw.slice(0, 240),
    };
    previewCache.set(voiceId, status);
    return status;
  } catch (error) {
    const status: VoicePreviewStatus = {
      checkedAt: now,
      hasAudio: null,
      error: error instanceof Error ? error.message : "voice preview failed",
    };
    previewCache.set(voiceId, status);
    return status;
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveLiveAvatarVoice(): Promise<LiveAvatarVoiceResolution> {
  const primaryVoiceId = VOICE_ID.trim();
  const fallbackVoiceId = FALLBACK_VOICE_ID.trim();
  const base: LiveAvatarVoiceResolution = {
    voiceId: primaryVoiceId,
    primaryVoiceId,
    fallbackVoiceId,
    usedFallback: false,
    reason: "primary_voice",
  };

  if (!primaryVoiceId || !fallbackVoiceId || fallbackVoiceId === primaryVoiceId) {
    return base;
  }

  const primaryPreview = await getVoicePreviewStatus(primaryVoiceId);
  if (primaryPreview.hasAudio !== false) {
    return {
      ...base,
      reason:
        primaryPreview.hasAudio === true
          ? "primary_preview_has_audio"
          : "primary_preview_unverified",
    };
  }

  const fallbackPreview = await getVoicePreviewStatus(fallbackVoiceId);
  if (fallbackPreview.hasAudio === false) {
    return {
      ...base,
      reason: "primary_and_fallback_preview_empty",
    };
  }

  return {
    ...base,
    voiceId: fallbackVoiceId,
    usedFallback: true,
    reason:
      fallbackPreview.hasAudio === true
        ? "primary_preview_empty_fallback_preview_has_audio"
        : "primary_preview_empty_fallback_unverified",
  };
}

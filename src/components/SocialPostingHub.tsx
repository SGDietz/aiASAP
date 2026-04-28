"use client";

import { useEffect, useMemo, useState } from "react";

type PlatformId = "x" | "tiktok" | "instagram" | "facebook" | "threads" | "youtube";

type PlatformStatus = {
  id: PlatformId;
  label: string;
  handle: string;
  publicUrl: string | null;
  configured: boolean;
  connected: boolean;
  missingEnv: string[];
  setupNotes: string[];
};

type SocialDraft = {
  id: string;
  title: string;
  body: string;
  platforms: PlatformId[];
  status: string;
  createdAt: string;
};

type StatusResponse = {
  authenticated: boolean;
  platforms: PlatformStatus[];
};

const DEFAULT_PLATFORMS: PlatformId[] = ["instagram", "facebook", "threads", "x", "tiktok"];
const FALLBACK_PLATFORM_STATUSES: PlatformStatus[] = [
  {
    id: "x",
    label: "X",
    handle: "@aiASAPai",
    publicUrl: "https://x.com/aiASAPai",
    configured: false,
    connected: false,
    missingEnv: ["status API unavailable"],
    setupNotes: [],
  },
  {
    id: "tiktok",
    label: "TikTok",
    handle: "@aiasap.ai",
    publicUrl: "https://www.tiktok.com/@aiasap.ai",
    configured: false,
    connected: false,
    missingEnv: ["status API unavailable"],
    setupNotes: [],
  },
  {
    id: "instagram",
    label: "Instagram",
    handle: "@aiasap.ai",
    publicUrl: "https://www.instagram.com/aiasap.ai/",
    configured: false,
    connected: false,
    missingEnv: ["status API unavailable"],
    setupNotes: [],
  },
  {
    id: "facebook",
    label: "Facebook",
    handle: "aiasapai",
    publicUrl: "https://www.facebook.com/aiasapai",
    configured: false,
    connected: false,
    missingEnv: ["status API unavailable"],
    setupNotes: [],
  },
  {
    id: "threads",
    label: "Threads",
    handle: "@aiasap.ai",
    publicUrl: "https://www.threads.com/@aiasap.ai",
    configured: false,
    connected: false,
    missingEnv: ["status API unavailable"],
    setupNotes: [],
  },
  {
    id: "youtube",
    label: "YouTube",
    handle: "aiASAP",
    publicUrl: null,
    configured: false,
    connected: false,
    missingEnv: ["status API unavailable"],
    setupNotes: [],
  },
];

function oauthProviderForPlatform(id: PlatformId) {
  return id === "instagram" || id === "facebook" ? "meta" : id;
}

function missingEnvSummary(platform: PlatformStatus) {
  if (!platform.missingEnv.length) return "No env gaps";
  if (platform.missingEnv.includes("status API unavailable")) return "Status unavailable";
  return `Needs ${platform.missingEnv.length} env`;
}

export function SocialPostingHub() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [drafts, setDrafts] = useState<SocialDraft[]>([]);
  const [title, setTitle] = useState("First aiASAP intro post");
  const [body, setBody] = useState(
    "Meet aiASAP: practical AI help for getting real-life tasks done faster.",
  );
  const [platforms, setPlatforms] = useState<PlatformId[]>(DEFAULT_PLATFORMS);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    const [statusRes, draftsRes] = await Promise.all([
      fetch("/api/social/status", { cache: "no-store" }),
      fetch("/api/social/drafts", { cache: "no-store" }),
    ]);
    const statusJson = (await statusRes.json().catch(() => null)) as Partial<StatusResponse> | null;
    setStatus({
      authenticated: statusJson?.authenticated === true,
      platforms: Array.isArray(statusJson?.platforms)
        ? statusJson.platforms
        : FALLBACK_PLATFORM_STATUSES,
    });
    const draftsJson = (await draftsRes.json()) as { drafts?: SocialDraft[] };
    setDrafts(Array.isArray(draftsJson.drafts) ? draftsJson.drafts : []);
  }

  useEffect(() => {
    void refresh().catch((error) => {
      console.error(error);
      setNotice("Could not load social hub status.");
    });
  }, []);

  const selectedCount = platforms.length;
  const platformList = Array.isArray(status?.platforms)
    ? status.platforms
    : FALLBACK_PLATFORM_STATUSES;
  const readyCount = useMemo(
    () => platformList.filter((platform) => platform.configured && platform.connected).length,
    [platformList],
  );

  async function createDraft() {
    setNotice(null);
    const res = await fetch("/api/social/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, platforms }),
    });
    const json = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setNotice(json?.error ?? "Draft create failed.");
      return;
    }
    setNotice("Draft saved. Next step is Telegram approval + real platform connections.");
    await refresh();
  }

  function togglePlatform(id: PlatformId) {
    setPlatforms((current) =>
      current.includes(id)
        ? current.filter((platform) => platform !== id)
        : [...current, id],
    );
  }

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#080403] px-3 py-4 text-[#f7dfbd] sm:px-8 sm:py-8">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-5 sm:gap-8">
        <header className="grid gap-4 rounded-[1.25rem] border border-[#e0aa62]/20 bg-[radial-gradient(circle_at_top_left,rgba(224,170,98,0.18),rgba(20,10,4,0.92)_45%,rgba(0,0,0,0.94))] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.45)] sm:rounded-[2rem] sm:p-8 lg:grid-cols-[1fr_24rem] lg:items-end">
          <div>
            <p className="text-[0.68rem] font-black uppercase tracking-[0.28em] text-[#e0aa62]/80 sm:text-sm sm:tracking-[0.32em]">
              aiASAP Social CENTCOM
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-black leading-[0.95] text-[#f1c477] sm:mt-4 sm:text-5xl lg:text-[3.35rem]">
              Create once. Approve in Telegram. Post everywhere.
            </h1>
            <p className="mt-3 max-w-3xl text-xs font-semibold leading-relaxed text-[#f7dfbd]/78 sm:mt-5 sm:text-base">
              X, TikTok, Instagram, Facebook, Threads, and YouTube in one drafting lane.
              Nothing posts until it clears Telegram approval.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold sm:mt-6 sm:gap-3 sm:text-sm">
              <span className="rounded-full bg-[#e0aa62] px-3 py-2 text-black sm:px-4">
                {readyCount} connected
              </span>
              <span className="rounded-full border border-[#e0aa62]/30 px-3 py-2 text-[#f1c477] sm:px-4">
                {status?.authenticated ? "Account active" : "Account required for saving drafts"}
              </span>
            </div>
          </div>
          <div className="hidden rounded-[1.25rem] border border-[#e0aa62]/20 bg-black/24 p-4 lg:block">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[#e0aa62]">
              Approval flow
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-black text-white/72">
              <span className="rounded-2xl bg-white/[0.07] px-3 py-3">Draft</span>
              <span className="rounded-2xl bg-[#e0aa62] px-3 py-3 text-black">Telegram</span>
              <span className="rounded-2xl bg-white/[0.07] px-3 py-3">Post</span>
            </div>
            <p className="mt-4 text-sm font-semibold leading-relaxed text-white/58">
              Current build is setup-only: connect accounts, save drafts, then wire posting.
            </p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {platformList.map((platform) => (
            <article
              key={platform.id}
              className="rounded-[1.1rem] border border-white/10 bg-white/[0.055] p-3 backdrop-blur sm:rounded-[1.4rem] sm:p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-white sm:text-xl">{platform.label}</h2>
                  <p className="mt-0.5 text-xs font-bold text-[#e0aa62] sm:mt-1 sm:text-sm">
                    {platform.handle}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[0.65rem] font-black sm:px-2.5 sm:text-xs ${
                    platform.connected
                      ? "bg-emerald-400 text-black"
                      : platform.configured
                        ? "bg-amber-300 text-black"
                        : "bg-white/10 text-white"
                  }`}
                >
                  {platform.connected ? "live" : platform.configured ? "ready" : "setup"}
                </span>
              </div>
              {platform.publicUrl && (
                <a
                  className="mt-2 inline-block text-xs font-bold text-[#f1c477] underline decoration-[#f1c477]/30 underline-offset-4 sm:mt-3 sm:text-sm"
                  href={platform.publicUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open profile
                </a>
              )}
              <p className="mt-3 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/45 sm:mt-4 sm:text-xs">
                Missing
              </p>
              <p className="mt-1 text-xs text-white/70 sm:min-h-10 sm:text-sm">
                <span className="sm:hidden">{missingEnvSummary(platform)}</span>
                <span className="hidden sm:inline">
                  {platform.missingEnv.length
                    ? platform.missingEnv.join(", ")
                    : "No env gaps detected"}
                </span>
              </p>
              <a
                className="mt-3 inline-flex w-full justify-center rounded-full bg-[#f1c477] px-3 py-2 text-xs font-black text-black sm:mt-4 sm:w-auto"
                href={`/api/social/${oauthProviderForPlatform(platform.id)}/start?returnTo=/social`}
              >
                {platform.connected ? "Reconnect" : "Connect"}
              </a>
            </article>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[1.8rem] border border-[#e0aa62]/20 bg-[#140b05] p-5 sm:p-6">
            <h2 className="text-2xl font-black text-[#f1c477]">New draft</h2>
            <label className="mt-5 block text-sm font-black uppercase tracking-[0.18em] text-white/55">
              Title
            </label>
            <input
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-lg font-bold text-white outline-none focus:border-[#e0aa62]"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <label className="mt-5 block text-sm font-black uppercase tracking-[0.18em] text-white/55">
              Caption / brief
            </label>
            <textarea
              className="mt-2 min-h-36 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-base font-semibold leading-relaxed text-white outline-none focus:border-[#e0aa62]"
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
            <div className="mt-5 flex flex-wrap gap-2">
              {platformList.map((platform) => (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() => togglePlatform(platform.id)}
                  className={`rounded-full px-4 py-2 text-sm font-black transition ${
                    platforms.includes(platform.id)
                      ? "bg-[#e0aa62] text-black"
                      : "bg-white/10 text-white"
                  }`}
                >
                  {platform.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void createDraft()}
              disabled={!selectedCount}
              className="mt-6 rounded-full bg-[#f1c477] px-6 py-3 text-base font-black text-black shadow-[0_10px_30px_rgba(224,170,98,0.22)] disabled:opacity-45"
            >
              Save draft
            </button>
            {notice && <p className="mt-4 text-sm font-bold text-[#f1c477]">{notice}</p>}
          </div>

          <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.055] p-5 sm:p-6">
            <h2 className="text-2xl font-black text-white">Next setup steps</h2>
            <ol className="mt-5 space-y-4 text-sm font-semibold leading-relaxed text-white/75">
              <li>1. Open `/social` after each deploy to see connection gaps.</li>
              <li>2. Connect Instagram to the Facebook Page in Meta account center.</li>
              <li>3. Create Meta/Threads, X, TikTok, and Google developer apps.</li>
              <li>4. Add each callback URL to the developer app and Vercel env vars.</li>
              <li>5. OAuth login once per platform, then store encrypted tokens.</li>
              <li>6. Add Telegram approval: draft, approve, post, log.</li>
            </ol>
            <div className="mt-6 rounded-2xl border border-[#e0aa62]/20 bg-black/24 p-4">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#e0aa62]">
                Callback URLs to use
              </p>
              <div className="mt-3 space-y-2 text-xs font-semibold text-white/70">
                <p>X: `/api/social/x/callback`</p>
                <p>TikTok: `/api/social/tiktok/callback`</p>
                <p>Meta: `/api/social/meta/callback`</p>
                <p>Threads: `/api/social/threads/callback`</p>
                <p>YouTube: `/api/social/youtube/callback`</p>
              </div>
            </div>
            <h3 className="mt-8 text-lg font-black text-[#f1c477]">Draft queue</h3>
            <div className="mt-3 space-y-3">
              {drafts.length ? (
                drafts.slice(0, 5).map((draft) => (
                  <article key={draft.id} className="rounded-2xl bg-black/24 p-4">
                    <p className="font-black text-white">{draft.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-white/65">{draft.body}</p>
                    <p className="mt-2 text-xs font-black uppercase tracking-[0.16em] text-[#e0aa62]">
                      {draft.platforms.join(" / ")}
                    </p>
                  </article>
                ))
              ) : (
                <p className="rounded-2xl bg-black/24 p-4 text-sm font-semibold text-white/60">
                  No drafts saved yet.
                </p>
              )}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

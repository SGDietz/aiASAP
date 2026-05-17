"use client";

import { useEffect, useMemo, useState } from "react";
import { Clipboard, ClipboardList, ExternalLink, Palette } from "lucide-react";

type PlatformId = "x" | "youtube" | "tiktok" | "facebook" | "instagram" | "threads";

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

type ArtworkRequirement = {
  platform: string;
  profile: string;
  banner?: string;
  content: string;
  note: string;
};

type SocialArtworkAsset = {
  label: string;
  file: string;
  size: string;
  use: string;
};

type SocialInstallAsset = {
  label: string;
  file: string;
  size: string;
  slot: string;
};

type SocialInstallTask = {
  id: PlatformId;
  label: string;
  handle: string;
  publicUrl: string;
  openUrl: string;
  installStatus: string;
  assets: SocialInstallAsset[];
  installed: string[];
  remaining: string[];
  notes: string[];
};

type StatusResponse = {
  authenticated: boolean;
  platforms: PlatformStatus[];
};

const DEFAULT_PLATFORMS: PlatformId[] = ["x", "youtube", "tiktok", "facebook", "instagram", "threads"];
const PLATFORM_LABELS: Record<PlatformId, string> = {
  x: "X",
  youtube: "YouTube",
  tiktok: "TikTok",
  facebook: "Facebook",
  instagram: "Instagram",
  threads: "Threads",
};
const PLATFORM_ORDER_INDEX = new Map(DEFAULT_PLATFORMS.map((platform, index) => [platform, index]));
const STABLE_SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://ai-asap.vercel.app";
const SOCIAL_STATUS_MESSAGES: Record<string, string> = {
  account_required: "Set up or verify an aiASAP account before connecting social accounts.",
  setup_required: "Developer app keys are missing. Use the setup checklist below for Shelly/keymaster.",
  connected: "Social account connected. Status will update after refresh.",
  invalid_state: "Connection expired. Start the platform connection again.",
  declined: "Connection was declined or cancelled.",
  missing_code: "Provider returned without an authorization code.",
  unknown_provider: "Unknown social provider.",
  error: "Social connection failed. Check the provider setup and callback URL.",
};
const PROVIDER_SETUP: Array<{
  id: string;
  label: string;
  covers: string;
  callbackPath: string;
  env: string[];
  priority: string;
  setupUrl: string;
}> = [
  {
    id: "x",
    label: "X",
    covers: "X / Twitter",
    callbackPath: "/api/social/x/callback",
    env: ["X_CLIENT_ID", "X_CLIENT_SECRET", "INTEGRATION_TOKEN_ENCRYPTION_KEY"],
    priority: "1",
    setupUrl: "https://developer.x.com/en/portal/dashboard",
  },
  {
    id: "youtube",
    label: "YouTube",
    covers: "YouTube",
    callbackPath: "/api/social/youtube/callback",
    env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "INTEGRATION_TOKEN_ENCRYPTION_KEY"],
    priority: "2",
    setupUrl: "https://console.cloud.google.com/apis/credentials",
  },
  {
    id: "tiktok",
    label: "TikTok",
    covers: "TikTok",
    callbackPath: "/api/social/tiktok/callback",
    env: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "INTEGRATION_TOKEN_ENCRYPTION_KEY"],
    priority: "3",
    setupUrl: "https://developers.tiktok.com/",
  },
  {
    id: "meta",
    label: "Meta",
    covers: "Facebook + Instagram",
    callbackPath: "/api/social/meta/callback",
    env: ["META_APP_ID", "META_APP_SECRET", "INTEGRATION_TOKEN_ENCRYPTION_KEY"],
    priority: "4 and 5",
    setupUrl: "https://developers.facebook.com/apps/",
  },
  {
    id: "threads",
    label: "Threads",
    covers: "Threads",
    callbackPath: "/api/social/threads/callback",
    env: ["THREADS_CLIENT_ID", "THREADS_CLIENT_SECRET", "INTEGRATION_TOKEN_ENCRYPTION_KEY"],
    priority: "6",
    setupUrl: "https://developers.facebook.com/docs/threads/",
  },
];
const ARTWORK_REQUIREMENTS: ArtworkRequirement[] = [
  {
    platform: "X",
    profile: "400x400",
    banner: "1500x500",
    content: "1080x1080 or 1600x900",
    note: "Use 6 face crop for the circle and a wide 6 hero for the banner.",
  },
  {
    platform: "YouTube",
    profile: "Square upload; renders at 98x98",
    banner: "2560x1440; keep text/logo in center safe area",
    content: "1280x720 thumbnails; 150x150 watermark",
    note: "The banner needs a large background with the important copy centered.",
  },
  {
    platform: "TikTok",
    profile: "200x200 minimum; export larger",
    content: "1080x1920 covers/videos",
    note: "Prioritize the face crop and readable vertical cover templates.",
  },
  {
    platform: "Facebook",
    profile: "320x320",
    banner: "851x315 minimum practical export",
    content: "1080x1350 or 1080x1080",
    note: "Keep the lower-left area calm because profile art can overlap the cover.",
  },
  {
    platform: "Instagram",
    profile: "320x320",
    content: "1080x1350 posts; 1080x1920 Reels/stories",
    note: "No banner; profile circle and vertical templates matter most.",
  },
  {
    platform: "Threads",
    profile: "640x640",
    content: "1440x1920 vertical posts",
    note: "Use the Instagram-matched profile art unless the account needs a variant.",
  },
];
const SOCIAL_ARTWORK_VERSION = "v12";
const SOCIAL_ARTWORK_INSTALL_PACK =
  "/social-artwork/v12/aiasap-social-artwork-v12-approved-install-pack.zip";
const OFFICIAL_CONTACT_EMAIL = "aiASAP@pm.me";
const SOCIAL_PROFILE_COPY =
  "TurboCharge Your Life by Talking to Your Computer. Build a Better Life, Create Content on AutoPilot, Build a Business. The All-In-One App (beta).";
const SOCIAL_ARTWORK_ASSETS: SocialArtworkAsset[] = [
  {
    label: "Proof sheet",
    file: "aiasap-social-artwork-v12-proof-sheet.png",
    size: "review",
    use: "One-sheet desktop review of the approved v12 LiveAvatar artwork kit.",
  },
  {
    label: "Real mobile font proof",
    file: "aiasap-real-mobile-font-proof-v12.png",
    size: "review",
    use: "Real mobile website aiASAP font styling from app CSS.",
  },
  {
    label: "Brand lockup HeadShot",
    file: "aiasap-6-brand-lockup-1024.png",
    size: "1024x1024",
    use: "Square brand image when the logo should appear with 6.",
  },
  {
    label: "Brand lockup alternate",
    file: "aiasap-6-brand-lockup-expressive-1024.png",
    size: "1024x1024",
    use: "Warmer square brand image for launch posts.",
  },
  {
    label: "Master profile HeadShot",
    file: "aiasap-6-profile-master-1024.png",
    size: "1024x1024",
    use: "Main source for profile circles.",
  },
  {
    label: "X profile",
    file: "x-profile-400.png",
    size: "400x400",
    use: "Upload to X profile image.",
  },
  {
    label: "X banner",
    file: "x-banner-1500x500.png",
    size: "1500x500",
    use: "Upload to X header/banner.",
  },
  {
    label: "YouTube banner",
    file: "youtube-banner-2560x1440.png",
    size: "2560x1440",
    use: "Upload to YouTube channel banner.",
  },
  {
    label: "YouTube thumbnail",
    file: "youtube-thumbnail-1280x720.png",
    size: "1280x720",
    use: "Template for intro videos.",
  },
  {
    label: "YouTube watermark",
    file: "youtube-watermark-150.png",
    size: "150x150",
    use: "Upload as YouTube video watermark.",
  },
  {
    label: "TikTok profile",
    file: "tiktok-profile-1024.png",
    size: "1024x1024",
    use: "Upload to TikTok profile image.",
  },
  {
    label: "TikTok cover",
    file: "tiktok-cover-1080x1920.png",
    size: "1080x1920",
    use: "TikTok cover/video template.",
  },
  {
    label: "Facebook profile",
    file: "facebook-profile-320.png",
    size: "320x320",
    use: "Upload to Facebook profile image.",
  },
  {
    label: "Facebook cover",
    file: "facebook-cover-851x315.png",
    size: "851x315",
    use: "Upload to Facebook page cover.",
  },
  {
    label: "Instagram profile",
    file: "instagram-profile-320.png",
    size: "320x320",
    use: "Upload to Instagram profile image.",
  },
  {
    label: "Instagram square",
    file: "instagram-square-1080.png",
    size: "1080x1080",
    use: "Square post template.",
  },
  {
    label: "Instagram portrait",
    file: "instagram-portrait-1080x1350.png",
    size: "1080x1350",
    use: "Portrait feed post template.",
  },
  {
    label: "Instagram reel cover",
    file: "instagram-reel-cover-1080x1920.png",
    size: "1080x1920",
    use: "Reel/story cover template.",
  },
  {
    label: "Threads profile",
    file: "threads-profile-640.png",
    size: "640x640",
    use: "Upload to Threads profile image.",
  },
  {
    label: "Threads vertical",
    file: "threads-post-1440x1920.png",
    size: "1440x1920",
    use: "Threads vertical post template.",
  },
];
const SOCIAL_INSTALL_TASKS: SocialInstallTask[] = [
  {
    id: "x",
    label: "X",
    handle: "@aiASAPai",
    publicUrl: "https://x.com/aiASAPai",
    openUrl: "https://x.com/settings/profile",
    installStatus: "Profile live; profile image retry waits for X account review.",
    assets: [
      {
        label: "Profile image",
        file: "x-profile-400.png",
        size: "400x400",
        slot: "Profile photo",
      },
      {
        label: "Header image",
        file: "x-banner-1500x500.png",
        size: "1500x500",
        slot: "Header/banner",
      },
    ],
    notes: [
      "Keep the approved no-ring Six profile crop.",
      "Use the face-forward banner; do not add separator bars.",
      "Use the exact approved beta bio/profile copy.",
    ],
    installed: [
      "Public URL saved: https://x.com/aiASAPai",
      "Bio installed with the approved beta copy.",
      "Header/banner installed.",
    ],
    remaining: [
      "Retry profile image only after X account review/limit clears.",
    ],
  },
  {
    id: "youtube",
    label: "YouTube",
    handle: "@aiASAP-1",
    publicUrl: "https://www.youtube.com/@aiASAP-1",
    openUrl: "https://studio.youtube.com/channel/UCdYcVn1eBVvRIH4xfbdLAsw/editing/profile",
    installStatus: "Channel identified and branded; watermark/first upload assets remain ready.",
    assets: [
      {
        label: "Channel picture",
        file: "x-profile-400.png",
        size: "400x400",
        slot: "Profile picture",
      },
      {
        label: "Channel banner",
        file: "youtube-banner-2560x1440.png",
        size: "2560x1440",
        slot: "Banner image",
      },
      {
        label: "Video watermark",
        file: "youtube-watermark-150.png",
        size: "150x150",
        slot: "Video watermark",
      },
      {
        label: "Thumbnail template",
        file: "youtube-thumbnail-1280x720.png",
        size: "1280x720",
        slot: "First upload thumbnail",
      },
    ],
    notes: [
      "Go to Customization, then Branding.",
      "Use the approved banner and watermark before any video upload.",
      "Public channel URL: https://www.youtube.com/@aiASAP-1",
      "Channel ID URL: https://www.youtube.com/channel/UCdYcVn1eBVvRIH4xfbdLAsw",
      "Use the exact approved beta bio/profile copy wherever YouTube asks for channel description or profile copy.",
      "Set contact email to aiASAP@pm.me if YouTube exposes that field.",
    ],
    installed: [
      "Public URL saved: https://www.youtube.com/@aiASAP-1",
      "Channel ID saved: UCdYcVn1eBVvRIH4xfbdLAsw",
      "Channel picture and all-device banner installed.",
    ],
    remaining: [
      "Use the watermark and thumbnail template when the first YouTube upload is prepared.",
    ],
  },
  {
    id: "tiktok",
    label: "TikTok",
    handle: "@aiasap.ai",
    publicUrl: "https://www.tiktok.com/@aiasap.ai",
    openUrl: "https://www.tiktok.com/@aiasap.ai",
    installStatus: "Profile image and bio installed; ready for first content upload.",
    assets: [
      {
        label: "Profile image",
        file: "tiktok-profile-1024.png",
        size: "1024x1024",
        slot: "Profile photo",
      },
      {
        label: "Vertical cover",
        file: "tiktok-cover-1080x1920.png",
        size: "1080x1920",
        slot: "Pinned/launch video cover",
      },
    ],
    notes: [
      "Use the approved profile crop.",
      "Use the vertical cover for the first launch video.",
      "Use the exact approved beta bio/profile copy.",
    ],
    installed: [
      "Public URL saved: https://www.tiktok.com/@aiasap.ai",
      "Profile image installed.",
      "Bio installed within TikTok's character limit.",
    ],
    remaining: [
      "Use the vertical cover template when the first TikTok video is prepared.",
    ],
  },
  {
    id: "facebook",
    label: "Facebook",
    handle: "aiasapai",
    publicUrl: "https://www.facebook.com/aiasapai",
    openUrl: "https://www.facebook.com/aiasapai",
    installStatus: "Page profile, cover, bio, and Messenger contact are live; phone removed.",
    assets: [
      {
        label: "Profile image",
        file: "facebook-profile-320.png",
        size: "320x320",
        slot: "Page profile photo",
      },
      {
        label: "Cover image",
        file: "facebook-cover-851x315.png",
        size: "851x315",
        slot: "Page cover photo",
      },
    ],
    notes: [
      "Use the Facebook page, not a personal profile.",
      "Watch the lower-left overlap from the profile image.",
      "Use the exact approved beta bio/profile copy wherever Facebook asks for page bio/about copy.",
      "Put aiASAP@pm.me anywhere Facebook asks for public contact email.",
    ],
    installed: [
      "Public URL saved: https://www.facebook.com/aiasapai",
      "Page profile photo, cover photo, and approved beta bio installed.",
      "Phone number removed; Messenger contact remains available as Aiasap.",
    ],
    remaining: [
      "Do not change the existing website field unless G explicitly asks.",
      "Page name still displays Aiasap; casing change to aiASAP may trigger Facebook review.",
    ],
  },
  {
    id: "instagram",
    label: "Instagram",
    handle: "@aiasap.ai",
    publicUrl: "https://www.instagram.com/aiasap.ai/",
    openUrl: "https://www.instagram.com/accounts/edit/",
    installStatus: "Profile photo and approved beta bio installed; website link is mobile-only.",
    assets: [
      {
        label: "Profile image",
        file: "instagram-profile-320.png",
        size: "320x320",
        slot: "Profile photo",
      },
      {
        label: "Square post",
        file: "instagram-square-1080.png",
        size: "1080x1080",
        slot: "Launch post",
      },
      {
        label: "Portrait post",
        file: "instagram-portrait-1080x1350.png",
        size: "1080x1350",
        slot: "Feed post",
      },
      {
        label: "Reel cover",
        file: "instagram-reel-cover-1080x1920.png",
        size: "1080x1920",
        slot: "Reel/story cover",
      },
    ],
    notes: [
      "Keep the Instagram profile matched to Threads.",
      "Use vertical artwork for Reels and stories.",
      "Use the exact approved beta bio/profile copy.",
    ],
    installed: [
      "Public URL saved: https://www.instagram.com/aiasap.ai/",
      "Profile photo installed.",
      "Full approved beta bio installed and visible behind Instagram's more truncation.",
    ],
    remaining: [
      "Instagram website links can only be edited on mobile; leave website unset unless G asks.",
    ],
  },
  {
    id: "threads",
    label: "Threads",
    handle: "@aiasap.ai",
    publicUrl: "https://www.threads.com/@aiasap.ai",
    openUrl: "https://www.threads.com/@aiasap.ai",
    installStatus: "Profile photo and approved beta bio installed.",
    assets: [
      {
        label: "Profile image",
        file: "threads-profile-640.png",
        size: "640x640",
        slot: "Profile photo",
      },
      {
        label: "Vertical post",
        file: "threads-post-1440x1920.png",
        size: "1440x1920",
        slot: "Launch post",
      },
    ],
    notes: [
      "Match the Instagram identity unless the platform crops differently.",
      "Use the vertical post template for launch content.",
      "Use the exact approved beta bio/profile copy.",
    ],
    installed: [
      "Public URL saved: https://www.threads.com/@aiasap.ai",
      "Profile photo installed.",
      "Full approved beta bio installed.",
    ],
    remaining: [
      "Use the vertical post template when the first Threads launch post is prepared.",
    ],
  },
];
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
    id: "youtube",
    label: "YouTube",
    handle: "@aiASAP-1",
    publicUrl: "https://www.youtube.com/@aiASAP-1",
    configured: false,
    connected: false,
    missingEnv: ["status API unavailable"],
    setupNotes: ["Studio: https://studio.youtube.com/channel/UCdYcVn1eBVvRIH4xfbdLAsw/editing/profile"],
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
    id: "threads",
    label: "Threads",
    handle: "@aiasap.ai",
    publicUrl: "https://www.threads.com/@aiasap.ai",
    configured: false,
    connected: false,
    missingEnv: ["status API unavailable"],
    setupNotes: [],
  },
];

function oauthProviderForPlatform(id: PlatformId) {
  return id === "instagram" || id === "facebook" ? "meta" : id;
}

function sortPlatformIds(ids: PlatformId[]) {
  return [...ids].sort(
    (a, b) => (PLATFORM_ORDER_INDEX.get(a) ?? 999) - (PLATFORM_ORDER_INDEX.get(b) ?? 999),
  );
}

function sortPlatformStatuses(platforms: PlatformStatus[]) {
  return [...platforms].sort(
    (a, b) => (PLATFORM_ORDER_INDEX.get(a.id) ?? 999) - (PLATFORM_ORDER_INDEX.get(b.id) ?? 999),
  );
}

function formatPlatformIds(ids: PlatformId[]) {
  return sortPlatformIds(ids)
    .map((id) => PLATFORM_LABELS[id])
    .join(" / ");
}

function missingEnvSummary(platform: PlatformStatus) {
  if (!platform.missingEnv.length) return "No env gaps";
  if (platform.missingEnv.includes("status API unavailable")) return "Status unavailable";
  return `Needs ${platform.missingEnv.length} env`;
}

function artworkSpecText(requirement: ArtworkRequirement) {
  return [
    `${requirement.platform} artwork`,
    `Profile: ${requirement.profile}`,
    requirement.banner ? `Banner: ${requirement.banner}` : null,
    `Content: ${requirement.content}`,
    `Note: ${requirement.note}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function artworkAssetPath(asset: SocialArtworkAsset) {
  return `/social-artwork/${SOCIAL_ARTWORK_VERSION}/${asset.file}`;
}

function artworkFilePath(file: string) {
  return `/social-artwork/${SOCIAL_ARTWORK_VERSION}/${file}`;
}

export function SocialPostingHub() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [drafts, setDrafts] = useState<SocialDraft[]>([]);
  const [accountEmail, setAccountEmail] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNotice, setAccountNotice] = useState<string | null>(null);
  const [title, setTitle] = useState("First aiASAP intro post");
  const [body, setBody] = useState(
    "Meet aiASAP: practical AI help for getting real-life tasks done faster.",
  );
  const [platforms, setPlatforms] = useState<PlatformId[]>(DEFAULT_PLATFORMS);
  const [notice, setNotice] = useState<string | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  async function refresh() {
    const [statusRes, draftsRes] = await Promise.all([
      fetch("/api/social/status", { cache: "no-store" }),
      fetch("/api/social/drafts", { cache: "no-store" }),
    ]);
    const statusJson = (await statusRes.json().catch(() => null)) as Partial<StatusResponse> | null;
    setStatus({
      authenticated: statusJson?.authenticated === true,
      platforms: sortPlatformStatuses(
        Array.isArray(statusJson?.platforms) ? statusJson.platforms : FALLBACK_PLATFORM_STATUSES,
      ),
    });
    const draftsJson = (await draftsRes.json()) as { drafts?: SocialDraft[] };
    setDrafts(Array.isArray(draftsJson.drafts) ? draftsJson.drafts : []);
  }

  useEffect(() => {
    const socialStatus = new URLSearchParams(window.location.search).get("social");
    if (socialStatus) {
      setNotice(SOCIAL_STATUS_MESSAGES[socialStatus] ?? `Social status: ${socialStatus}`);
    }
    void refresh().catch((error) => {
      console.error(error);
      setNotice("Could not load social hub status.");
    });
  }, []);

  const selectedCount = platforms.length;
  const platformList = useMemo(
    () => sortPlatformStatuses(Array.isArray(status?.platforms) ? status.platforms : FALLBACK_PLATFORM_STATUSES),
    [status?.platforms],
  );
  const readyCount = useMemo(
    () => platformList.filter((platform) => platform.configured && platform.connected).length,
    [platformList],
  );

  async function createDraft() {
    setNotice(null);
    const res = await fetch("/api/social/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, platforms: sortPlatformIds(platforms) }),
    });
    const json = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setNotice(json?.error ?? "Draft create failed.");
      return;
    }
    setNotice("Draft saved. Next step is Telegram approval + real platform connections.");
    await refresh();
  }

  async function startAccount() {
    setAccountNotice(null);
    const res = await fetch("/api/account/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: accountEmail, fullName: accountName }),
    });
    const json = (await res.json().catch(() => null)) as {
      error?: string;
      emailSent?: boolean;
      verificationUrl?: string | null;
    } | null;
    if (!res.ok) {
      setAccountNotice(json?.error ?? "Account setup failed.");
      return;
    }
    if (json?.verificationUrl) {
      setAccountNotice(`Verification link: ${json.verificationUrl}`);
      return;
    }
    setAccountNotice(
      json?.emailSent
        ? "Check your email for the aiASAP sign-in link, then return here."
        : "Account link created. Check email delivery settings if no message arrives.",
    );
  }

  function togglePlatform(id: PlatformId) {
    setPlatforms((current) =>
      current.includes(id)
        ? current.filter((platform) => platform !== id)
        : sortPlatformIds([...current, id]),
    );
  }

  function callbackUrl(path: string) {
    return `${STABLE_SITE_ORIGIN}${path}`;
  }

  function setupChecklistText() {
    return [
      "aiASAP Social CENTCOM setup checklist",
      "",
      "Platform order: X, YouTube, TikTok, Facebook, Instagram, Threads.",
      "",
      ...PROVIDER_SETUP.flatMap((provider) => [
        `${provider.label} (${provider.covers})`,
        `Callback: ${callbackUrl(provider.callbackPath)}`,
        `Env: ${provider.env.join(", ")}`,
        "",
      ]),
      "Add env vars in Vercel, redeploy, then connect accounts from /social.",
    ].join("\n");
  }

  function artworkChecklistText() {
    return [
      "aiASAP TurboCharge Your Life artwork kit",
      "",
      `Core social bio/profile rule: ${SOCIAL_PROFILE_COPY}`,
      "",
      "Brand rule: 6 is the face of the brand. Use the approved no-ring HeadShot crop for profile circles, much larger face-focused 6 images for banners and covers, the real mobile website aiASAP font styling from app CSS, and the soft-brown palette with muted brown-gold accents. Do not use screenshot scans, teal/tan separator bars, or decorative accent lines.",
      "",
      ...ARTWORK_REQUIREMENTS.flatMap((requirement) => [
        artworkSpecText(requirement),
        "",
      ]),
      "Approved files ready to install: 6 profile icons, 6 hero banners and covers, square post template, vertical post template, YouTube thumbnail, and YouTube watermark.",
      `Approved install pack: ${SOCIAL_ARTWORK_INSTALL_PACK}`,
    ].join("\n");
  }

  function installTaskText(task: SocialInstallTask) {
    return [
      `${task.label} install`,
      `Handle: ${task.handle}`,
      `Public URL: ${task.publicUrl}`,
      `Open: ${task.openUrl}`,
      `Status: ${task.installStatus}`,
      `Contact email: ${OFFICIAL_CONTACT_EMAIL}`,
      `Profile copy: ${SOCIAL_PROFILE_COPY}`,
      "",
      "Installed:",
      ...task.installed.map((item) => `- ${item}`),
      "",
      "Remaining:",
      ...task.remaining.map((item) => `- ${item}`),
      "",
      "Assets:",
      ...task.assets.map(
        (asset) =>
          `${asset.slot}: ${asset.file} (${asset.size}) - ${window.location.origin}${artworkFilePath(asset.file)}`,
      ),
      "",
      "Notes:",
      ...task.notes.map((note) => `- ${note}`),
    ].join("\n");
  }

  function publicArtworkUrl(asset: SocialArtworkAsset) {
    if (typeof window === "undefined") return artworkAssetPath(asset);
    return `${window.location.origin}${artworkAssetPath(asset)}`;
  }

  function publicArtworkFileUrl(file: string) {
    if (typeof window === "undefined") return artworkFilePath(file);
    return `${window.location.origin}${artworkFilePath(file)}`;
  }

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyNotice(`${label} copied`);
    } catch {
      setCopyNotice(`Could not copy ${label.toLowerCase()}`);
    }
  }

  return (
    <main className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#080403] px-3 py-4 text-[#f7dfbd] sm:px-8 sm:py-8">
      <section className="mx-auto flex w-full min-w-0 max-w-[calc(100vw-1.5rem)] flex-col gap-5 sm:max-w-6xl sm:gap-8">
        <header className="grid max-w-full min-w-0 gap-4 overflow-hidden rounded-[1.25rem] border border-[#e0aa62]/20 bg-[radial-gradient(circle_at_top_left,rgba(224,170,98,0.18),rgba(20,10,4,0.92)_45%,rgba(0,0,0,0.94))] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.45)] sm:rounded-[2rem] sm:p-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-end">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.28em] text-[#e0aa62]/80 sm:text-sm sm:tracking-[0.32em]">
              aiASAP Social CENTCOM
            </p>
            <h1 className="mt-3 max-w-3xl break-words text-3xl font-black leading-[0.95] text-[#f1c477] sm:mt-4 sm:text-5xl lg:text-[3.35rem]">
              TurboCharge Your Life.
            </h1>
            <p className="mt-3 max-w-3xl break-words text-xs font-semibold leading-relaxed text-[#f7dfbd]/78 sm:mt-5 sm:text-base">
              aiASAP helps people use AI to move their real lives forward. Life Builder
              is a major lane, while the heart is making useful AI feel easy, friendly,
              and available as soon as possible.
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

        <section className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {platformList.map((platform) => (
            <article
              key={platform.id}
              className="min-w-0 rounded-[1.1rem] border border-white/10 bg-white/[0.055] p-3 backdrop-blur sm:rounded-[1.4rem] sm:p-4"
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
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#f1c477]/35 px-3 py-1.5 text-[0.7rem] font-black text-[#f1c477] transition hover:border-[#f1c477] sm:text-xs"
                    href={platform.publicUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                    Open
                  </a>
                  <button
                    type="button"
                    onClick={() => void copyText(`${platform.label} link`, platform.publicUrl ?? "")}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[0.7rem] font-black text-white transition hover:bg-white/15 sm:text-xs"
                  >
                    <Clipboard aria-hidden="true" className="h-3.5 w-3.5" />
                    Copy link
                  </button>
                </div>
              )}
              <p className="mt-3 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/45 sm:mt-4 sm:text-xs">
                {platform.missingEnv.length ? "Missing setup" : "Connection"}
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
                href={
                  status?.authenticated
                    ? `/api/social/${oauthProviderForPlatform(platform.id)}/start?returnTo=/social`
                    : "#account-setup"
                }
                onClick={() => {
                  if (!status?.authenticated) {
                    setNotice(`Create or verify an aiASAP account first, then connect ${platform.label}.`);
                  }
                }}
              >
                {platform.connected ? "Reconnect" : "Connect"}
              </a>
            </article>
          ))}
        </section>

        <section className="rounded-[1.8rem] border border-[#e0aa62]/20 bg-[#140b05] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-[#e0aa62]">
                <Palette aria-hidden="true" className="h-4 w-4" />
                TurboCharge artwork
              </p>
              <h2 className="mt-3 text-2xl font-black text-[#f1c477] sm:text-3xl">
                6 is the face. Export only what each platform needs.
              </h2>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-relaxed text-white/62">
                Approved artwork install kit. Use these exact files for social profile images,
                banners, covers, thumbnails, watermarks, and launch post templates.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void copyText("Artwork checklist", artworkChecklistText())}
              className="inline-flex items-center gap-2 rounded-full bg-[#f1c477] px-4 py-2 text-xs font-black text-black"
            >
              <ClipboardList aria-hidden="true" className="h-4 w-4" />
              Copy artwork plan
            </button>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {ARTWORK_REQUIREMENTS.map((requirement) => (
              <article
                key={requirement.platform}
                className="rounded-2xl border border-white/10 bg-black/24 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-black text-white">{requirement.platform}</h3>
                  <button
                    type="button"
                    onClick={() =>
                      void copyText(`${requirement.platform} artwork specs`, artworkSpecText(requirement))
                    }
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[0.68rem] font-black text-white transition hover:bg-white/15"
                  >
                    <Clipboard aria-hidden="true" className="h-3.5 w-3.5" />
                    Copy specs
                  </button>
                </div>
                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/40">
                      Profile
                    </dt>
                    <dd className="mt-1 font-bold text-[#f7dfbd]">{requirement.profile}</dd>
                  </div>
                  {requirement.banner && (
                    <div>
                      <dt className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/40">
                        Banner
                      </dt>
                      <dd className="mt-1 font-bold text-[#f7dfbd]">{requirement.banner}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/40">
                      Content
                    </dt>
                    <dd className="mt-1 font-bold text-[#f7dfbd]">{requirement.content}</dd>
                  </div>
                </dl>
                <p className="mt-4 text-xs font-semibold leading-relaxed text-white/55">
                  {requirement.note}
                </p>
              </article>
            ))}
          </div>
          <div className="mt-8 rounded-2xl border border-[#e0aa62]/20 bg-black/24 p-4">
            <div className="mb-8 rounded-2xl border border-[#f1c477]/25 bg-[#080403]/80 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-[#e0aa62]">
                    Install console
                  </p>
                  <h3 className="mt-2 text-2xl font-black text-[#f1c477]">
                    X, YouTube, TikTok, Facebook, Instagram, Threads.
                  </h3>
                  <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-white/58">
                    Use this order everywhere. Open the account page, upload the exact approved
                    assets, copy the same approved profile copy, and use {OFFICIAL_CONTACT_EMAIL}{" "}
                    wherever a public contact email belongs.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void copyText("Profile copy", SOCIAL_PROFILE_COPY)}
                    className="inline-flex items-center gap-2 rounded-full bg-[#f1c477] px-4 py-2 text-xs font-black text-black"
                  >
                    <Clipboard aria-hidden="true" className="h-4 w-4" />
                    Copy profile copy
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyText("Contact email", OFFICIAL_CONTACT_EMAIL)}
                    className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black text-white transition hover:bg-white/15"
                  >
                    <Clipboard aria-hidden="true" className="h-4 w-4" />
                    Copy email
                  </button>
                </div>
              </div>
              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {SOCIAL_INSTALL_TASKS.map((task, index) => (
                  <article key={task.id} className="rounded-2xl border border-white/10 bg-black/32 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-white/42">
                          Step {index + 1}
                        </p>
                        <h4 className="mt-1 text-xl font-black text-white">{task.label}</h4>
                        <p className="mt-1 text-sm font-black text-[#e0aa62]">{task.handle}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <a
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#f1c477]/35 px-3 py-1.5 text-xs font-black text-[#f1c477] transition hover:border-[#f1c477]"
                          href={task.publicUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                          Public
                        </a>
                        <a
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#f1c477]/35 px-3 py-1.5 text-xs font-black text-[#f1c477] transition hover:border-[#f1c477]"
                          href={task.openUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                          Setup
                        </a>
                        <button
                          type="button"
                          onClick={() => void copyText(`${task.label} install`, installTaskText(task))}
                          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-white transition hover:bg-white/15"
                        >
                          <Clipboard aria-hidden="true" className="h-3.5 w-3.5" />
                          Copy
                        </button>
                      </div>
                    </div>
                    <p className="mt-3 rounded-xl border border-[#e0aa62]/20 bg-[#080403]/70 p-3 text-xs font-bold leading-relaxed text-[#f7dfbd]/80">
                      {task.installStatus}
                    </p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl bg-black/35 p-3">
                        <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-emerald-300">
                          Installed / saved
                        </p>
                        <ul className="mt-2 space-y-1.5 text-xs font-semibold leading-relaxed text-white/62">
                          {task.installed.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-xl bg-black/35 p-3">
                        <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-[#f1c477]">
                          Remaining
                        </p>
                        <ul className="mt-2 space-y-1.5 text-xs font-semibold leading-relaxed text-white/62">
                          {task.remaining.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="mt-4 grid min-w-0 gap-2">
                      {task.assets.map((asset) => (
                        <div
                          key={`${task.id}-${asset.file}`}
                          className="grid min-w-0 gap-3 rounded-xl border border-white/10 bg-black/35 p-2 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto] sm:items-center"
                        >
                          <a href={artworkFilePath(asset.file)} target="_blank" rel="noreferrer">
                            <img
                              alt={`${task.label} ${asset.label} preview`}
                              className="h-16 w-16 rounded-lg border border-white/10 bg-[#080403] object-contain p-1"
                              src={artworkFilePath(asset.file)}
                            />
                          </a>
                          <div className="min-w-0">
                            <p className="text-sm font-black text-white">{asset.label}</p>
                            <p className="mt-0.5 text-xs font-semibold text-white/56">
                              {asset.slot} · {asset.size}
                            </p>
                            <p className="mt-1 break-all font-mono text-[0.65rem] text-white/42">
                              {asset.file}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <a
                              className="inline-flex items-center justify-center rounded-full border border-[#f1c477]/35 px-3 py-1.5 text-[0.68rem] font-black text-[#f1c477] transition hover:border-[#f1c477]"
                              href={artworkFilePath(asset.file)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open
                            </a>
                            <button
                              type="button"
                              onClick={() =>
                                void copyText(`${asset.label} link`, publicArtworkFileUrl(asset.file))
                              }
                              className="inline-flex items-center justify-center rounded-full bg-white/10 px-3 py-1.5 text-[0.68rem] font-black text-white transition hover:bg-white/15"
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <ul className="mt-4 space-y-1.5 text-xs font-semibold leading-relaxed text-white/56">
                      {task.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-[#e0aa62]">
                  Current artwork files
                </p>
                <p className="mt-2 text-xs font-semibold leading-relaxed text-white/55">
                  Version {SOCIAL_ARTWORK_VERSION} uses the approved C tone, final no-ring profile
                  framing, much larger face-focused 6 banner and cover crops, the stronger mobile-style italic aiASAP font
                  styling from app CSS, the soft-brown palette, and no teal/tan separator bars. Use
                  Open for desktop review. Copy links are ready for platform setup and handoff.
                </p>
              </div>
              <span className="rounded-full border border-[#f1c477]/35 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#f1c477]">
                G approved
              </span>
              <a
                className="inline-flex items-center gap-2 rounded-full bg-[#f1c477] px-4 py-2 text-xs font-black text-black"
                href={`/social-artwork/${SOCIAL_ARTWORK_VERSION}/aiasap-social-artwork-${SOCIAL_ARTWORK_VERSION}-proof-sheet.png`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink aria-hidden="true" className="h-4 w-4" />
                Open proof sheet
              </a>
              <a
                className="inline-flex items-center gap-2 rounded-full border border-[#f1c477]/35 px-4 py-2 text-xs font-black text-[#f1c477] transition hover:border-[#f1c477]"
                href={SOCIAL_ARTWORK_INSTALL_PACK}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink aria-hidden="true" className="h-4 w-4" />
                Open install pack
              </a>
              <button
                type="button"
                onClick={() =>
                  void copyText(
                    "Approved install pack link",
                    typeof window === "undefined"
                      ? SOCIAL_ARTWORK_INSTALL_PACK
                      : `${window.location.origin}${SOCIAL_ARTWORK_INSTALL_PACK}`,
                  )
                }
                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black text-white transition hover:bg-white/15"
              >
                <Clipboard aria-hidden="true" className="h-4 w-4" />
                Copy pack link
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {SOCIAL_ARTWORK_ASSETS.map((asset) => (
                <article
                  key={asset.file}
                  className="rounded-2xl border border-white/10 bg-black/30 p-3"
                >
                  <a href={artworkAssetPath(asset)} target="_blank" rel="noreferrer">
                    <img
                      alt={`${asset.label} preview`}
                      className="aspect-[16/10] w-full rounded-xl border border-white/10 bg-[#080403] object-contain p-2"
                      src={artworkAssetPath(asset)}
                    />
                  </a>
                  <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-white">{asset.label}</h3>
                      <p className="mt-1 text-xs font-bold text-[#e0aa62]">{asset.size}</p>
                    </div>
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] text-white/70">
                      Approved
                    </span>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <a
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#f1c477]/35 px-3 py-1.5 text-[0.68rem] font-black text-[#f1c477] transition hover:border-[#f1c477]"
                        href={artworkAssetPath(asset)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                        Open
                      </a>
                      <button
                        type="button"
                        onClick={() => void copyText(`${asset.label} link`, publicArtworkUrl(asset))}
                        className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[0.68rem] font-black text-white transition hover:bg-white/15"
                      >
                        <Clipboard aria-hidden="true" className="h-3.5 w-3.5" />
                        Copy
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs font-semibold leading-relaxed text-white/55">
                    {asset.use}
                  </p>
                  <p className="mt-2 break-all rounded-xl bg-black/40 p-2 font-mono text-[0.65rem] text-white/60">
                    {artworkAssetPath(asset)}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {!status?.authenticated && (
          <section
            id="account-setup"
            className="rounded-[1.8rem] border border-[#e0aa62]/30 bg-[#140b05] p-5 sm:p-6"
          >
            <h2 className="text-2xl font-black text-[#f1c477]">Create aiASAP account</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-white/65">
              This signs you into aiASAP so connected Google, YouTube, and social tokens can be
              stored to your account.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-white/50">
                  Email
                </span>
                <input
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-base font-bold text-white outline-none focus:border-[#e0aa62]"
                  value={accountEmail}
                  onChange={(event) => setAccountEmail(event.target.value)}
                  placeholder="aiASAP@pm.me"
                  type="email"
                />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-white/50">
                  Name
                </span>
                <input
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-base font-bold text-white outline-none focus:border-[#e0aa62]"
                  value={accountName}
                  onChange={(event) => setAccountName(event.target.value)}
                  placeholder="G"
                />
              </label>
              <button
                type="button"
                onClick={() => void startAccount()}
                className="rounded-full bg-[#f1c477] px-6 py-3 text-sm font-black text-black"
              >
                Send sign-in link
              </button>
            </div>
            {accountNotice && (
              <p className="mt-4 break-words text-sm font-bold text-[#f1c477]">{accountNotice}</p>
            )}
          </section>
        )}

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
              <li>2. Create X, Google/YouTube, TikTok, Meta, and Threads developer apps.</li>
              <li>3. Connect Facebook and Instagram through the Meta account center.</li>
              <li>4. Add each stable callback URL to the developer app and Vercel env vars.</li>
              <li>5. OAuth login once per platform, then store encrypted tokens.</li>
              <li>6. Add Telegram approval: draft, approve, post, log.</li>
            </ol>
            <div className="mt-6 rounded-2xl border border-[#e0aa62]/20 bg-black/24 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-[#e0aa62]">
                  Keymaster checklist
                </p>
                <button
                  type="button"
                  onClick={() => void copyText("Setup checklist", setupChecklistText())}
                  className="rounded-full bg-[#f1c477] px-4 py-2 text-xs font-black text-black"
                >
                  Copy all
                </button>
              </div>
              {copyNotice && <p className="mt-2 text-xs font-black text-[#f1c477]">{copyNotice}</p>}
              <p className="mt-3 text-xs font-semibold leading-relaxed text-white/55">
                Use these stable production callbacks, not temporary preview-domain callbacks.
              </p>
              <div className="mt-4 space-y-3">
                {PROVIDER_SETUP.map((provider) => (
                  <article key={provider.id} className="rounded-2xl border border-white/10 bg-black/30 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-black text-white">
                          {provider.label} <span className="text-white/45">({provider.covers})</span>
                        </p>
                        <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-[#e0aa62]">
                          {provider.priority}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void copyText(`${provider.label} callback`, callbackUrl(provider.callbackPath))}
                        className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-white"
                      >
                        Copy callback
                      </button>
                    </div>
                    <p className="mt-3 break-all rounded-xl bg-black/40 p-2 font-mono text-[0.68rem] text-white/72">
                      {callbackUrl(provider.callbackPath)}
                    </p>
                    <a
                      className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[#f1c477]/35 px-3 py-1.5 text-xs font-black text-[#f1c477] transition hover:border-[#f1c477]"
                      href={provider.setupUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                      Open setup
                    </a>
                    <p className="mt-2 text-xs font-semibold leading-relaxed text-white/55">
                      Env: {provider.env.join(", ")}
                    </p>
                  </article>
                ))}
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
                      {formatPlatformIds(draft.platforms)}
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

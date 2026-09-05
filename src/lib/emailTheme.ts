/**
 * aiASAP email theme — ONE source for what every aiASAP email looks like.
 *
 * G, 2026-08-25: all aiASAP emails should be in the aiASAP theme colours.
 *
 * WHERE THESE VALUES COME FROM — read this before changing a single hex.
 * They are lifted VERBATIM from the magic-link email, which G locked on
 * 2026-06-04 and whose file says in plain words: do not change the layout or
 * copy without G (#1.5.1). Nothing here is invented and nothing is "improved."
 * This module exists so the look G already approved stops being copy-pasted
 * into every new email by hand — it was duplicated in four places
 * (magicLinkEmail, accountDeletionEmails, dataDownloadEmail, and the reminders
 * cron route) and a fifth email (teamNotify) had no styling at all.
 *
 * THE LOCKED MAGIC-LINK EMAIL IS NOT WIRED TO THIS MODULE ON PURPOSE. It is
 * G-locked; leaving it byte-for-byte untouched is safer than refactoring it to
 * prove a point. If it is ever migrated, diff the generated HTML and require it
 * to be byte-identical first.
 *
 * The brand: gold-amber gradient — #ffe9c2 cream, #d7a05a amber, #3a2108 dark
 * brown. Never raw black and never grey (CLAUDE.md branding rule); the darks
 * below are all warm browns, which is why they are #0e0803 and #1d1209 rather
 * than #000 or #111.
 *
 * ONE TECHNICAL RULE, learned the hard way and recorded in the locked file:
 * gold text is SOLID gold, never -webkit-background-clip:text. The clip
 * gradient rendered as invisible text on Android Gmail. Element backgrounds
 * (the button) DO render as gradients — text does not. Do not reintroduce it.
 */

/** The brand colours, by the role each one plays in an email. */
export const THEME = {
  /** Page ground behind the card. Warm near-black brown, never #000. */
  pageBg: "#0e0803",
  /** The radial surround painted over the page ground. */
  pageSurround:
    "radial-gradient(circle at 50% -8%, #34200f 0%, #1a0f06 50%, #0e0803 100%)",
  /** Solid fallback for clients that drop gradients. */
  pageBgFallback: "#160c04",
  /** The card the content sits on. */
  cardBg: "#1d1209",
  /** Card border / divider rule. */
  cardBorder: "#4a2f14",
  /** Wordmark gold. */
  wordmark: "#f4d086",
  /** Tagline gold. */
  tagline: "#d9a85e",
  /** Headline gold. */
  heading: "#f1c87e",
  /** Body copy gold. */
  body: "#e2bd84",
  /** Muted fine print. */
  fine: "#a98a63",
  /** Footer text / footer link. */
  foot: "#b39a50",
  footLink: "#cda966",
  /** Primary button: the real gold gradient, on dark brown ink. */
  buttonBg:
    "linear-gradient(180deg,#ffda6c 0%,#f3bc53 39%,#c6873a 72%,#915a27 100%)",
  buttonBgFallback: "#f0b84e",
  buttonInk: "#3a2108",
  /** Secondary button. */
  buttonSecondaryBg: "#241608",
  buttonSecondaryBorder: "#6b4621",
} as const;

const SANS = "-apple-system,'Segoe UI',Roboto,Arial,sans-serif";
const BLACK_FACE = "'Arial Black','Archivo Black',Impact,sans-serif";

/**
 * 6's face for email. G, 2026-09-04: "I don't think we need the full avatar
 * look in the emails, but all emails should have the top of 6, his face at
 * least."
 *
 * A head-and-shoulders crop of the same start-screen frame, uploaded as a NEW
 * object - `startscreen_trim.png` is untouched and still serves the full-body
 * look anywhere else that wants it. Cropping here rather than with CSS on
 * purpose: mail clients strip object-fit and negative margins, so the only
 * reliable crop is the file itself.
 */
export const SIX_PHOTO_URL =
  "https://wqszxsqzkaatghyrqviv.supabase.co/storage/v1/object/public/email-assets/six_face.png";

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

/** A body paragraph. */
export function emailParagraph(html: string): string {
  return `<p>${html}</p>`;
}

/** Small print under the button or the divider. */
export function emailFine(html: string): string {
  return `<p class="fine">${html}</p>`;
}

/** The hairline rule. */
export function emailDivider(): string {
  return `<div class="divider"></div>`;
}

/** Primary gold call-to-action. */
export function emailButton(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" class="btn">${label}</a>`;
}

/** Quieter secondary action. */
export function emailButtonSecondary(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" class="btn2">${label}</a>`;
}

/**
 * Label / value rows, left-aligned. For notification mail where the point is
 * the facts, not a call to action.
 */
export function emailRows(
  rows: Array<[string, string | null | undefined]>,
): string {
  const live = rows.filter(([, value]) => Boolean(value));
  if (!live.length) return "";
  const body = live
    .map(
      ([label, value]) =>
        `<tr><td class="k">${escapeHtml(label)}</td><td class="v">${escapeHtml(String(value))}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" class="rows">${body}</table>`;
}

/**
 * The visitor's own words, as a pull quote. On a bug or feedback mail this is
 * the single most important line in the message and it should not be buried in
 * a paragraph of machine facts.
 */
export function emailQuote(text: string): string {
  return `<div class="quote">&#8220;${escapeHtml(text)}&#8221;</div>`;
}

/**
 * A short back-and-forth, oldest first. 6 and the visitor are told apart by
 * colour and label rather than by two spaces of indent in a <pre> block.
 */
export function emailChat(
  turns: Array<{ role: string; text: string }>,
): string {
  if (!turns.length) return "";
  const body = turns
    .map((turn) => {
      const isUser = turn.role === "user";
      return `<div class="turn${isUser ? " u" : ""}"><span class="who">${
        isUser ? "They said" : "6"
      }</span>${escapeHtml(turn.text)}</div>`;
    })
    .join("");
  return `<div class="chat">${body}</div>`;
}

/** Pre-formatted block that keeps its own line breaks. */
export function emailPre(text: string): string {
  return `<div class="pre">${escapeHtml(text)}</div>`;
}

/**
 * The aiASAP email shell.
 *
 * `bodyHtml` is trusted markup from the helpers above. `heading` and `subject`
 * are escaped here.
 */
export function emailShell(args: {
  /** <title>, and the fallback subject line shown by some clients. */
  title: string;
  /** The gold H1 inside the card. */
  heading: string;
  /** Pre-built markup from the helpers above. */
  bodyHtml: string;
  /** Show 6's framed photo under the wordmark. Defaults to true. */
  showSix?: boolean;
  /**
   * "small" = 150px face for notification mail G reads on his phone: his face
   * is there (G 2026-09-04: "all emails should have the top of 6, his face at
   * least") without pushing the facts off the first screen.
   */
  sixSize?: "full" | "small";
  /** Left-align the card contents. Notification mail reads better this way. */
  align?: "center" | "left";
}): string {
  const align = args.align ?? "center";
  const six =
    args.showSix === false
      ? ""
      : `<div class="sixrow"><span class="sixwrap"><img src="${SIX_PHOTO_URL}" alt="6, your a-i-buddy" class="six${args.sixSize === "small" ? " small" : ""}"></span></div>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${escapeHtml(args.title)}</title>
<style>
  body { margin:0; padding:0; background:${THEME.pageBg}; -webkit-font-smoothing:antialiased; }
  .wrap { width:100%; background: ${THEME.pageSurround}; background-color:${THEME.pageBgFallback}; padding: 40px 16px; }
  .card { max-width: 540px; margin:0 auto; background:${THEME.cardBg}; background-color:${THEME.cardBg}; border:1px solid ${THEME.cardBorder}; border-radius:24px; overflow:hidden; box-shadow:0 24px 70px rgba(0,0,0,.6); }
  .inner { padding: 40px 40px 30px; text-align:${align}; font-family:${SANS}; }
  .wordmark { font-family:${BLACK_FACE}; font-style:italic; font-size:36px; letter-spacing:.5px; color:${THEME.wordmark}; margin:0 0 4px; text-align:center; }
  /* 7px was sized for the three short words of the old tagline; the current
     one is four and wrapped onto two lines at that spacing. */
  .tag { font-family:${SANS}; font-size:12px; font-weight:800; letter-spacing:2.2px; text-transform:uppercase; color:${THEME.tagline}; margin:0 0 24px; text-align:center; }
  .sixrow { text-align:center; }
  .sixwrap { display:inline-block; line-height:0; font-size:0; }
  .six { display:block; width:300px; max-width:78%; border-radius:34px; border:1px solid rgba(215,160,90,0.40); background:rgba(0,0,0,0.35); box-shadow:0 0 0 1px rgba(215,160,90,0.45), 0 30px 90px rgba(0,0,0,0.72); margin:0 auto; }
  .six.small { width:150px; border-radius:22px; box-shadow:0 0 0 1px rgba(215,160,90,0.45), 0 18px 50px rgba(0,0,0,0.6); }
  h1 { font-size:26px; color:${THEME.heading}; margin:26px 0 12px; font-weight:800; }
  p { font-size:16px; line-height:1.6; margin:0 0 20px; color:${THEME.body}; }
  .btn { display:inline-block; margin:8px 6px 4px; padding:16px 46px; border-radius:14px; background:${THEME.buttonBg}; background-color:${THEME.buttonBgFallback}; color:${THEME.buttonInk} !important; font-weight:800; font-size:18px; text-decoration:none; box-shadow:0 10px 26px rgba(215,160,90,.4); }
  .btn2 { display:inline-block; margin:8px 6px 4px; padding:15px 36px; border-radius:14px; background:${THEME.buttonSecondaryBg}; border:1px solid ${THEME.buttonSecondaryBorder}; color:${THEME.body} !important; font-weight:800; font-size:16px; text-decoration:none; }
  .divider { height:1px; width:70%; margin:30px auto 0; background:${THEME.cardBorder}; }
  .fine { font-size:13px; line-height:1.55; margin-top:22px; color:${THEME.fine}; }
  .rows { width:100%; border-collapse:collapse; margin:0 0 18px; text-align:left; }
  .rows .k { width:34%; padding:9px 12px 9px 0; color:${THEME.tagline}; font-size:12px; font-weight:800; letter-spacing:1.2px; text-transform:uppercase; vertical-align:top; border-bottom:1px solid rgba(215,160,90,0.14); }
  .rows .v { padding:9px 0; color:${THEME.body}; font-size:15px; font-weight:600; white-space:pre-wrap; border-bottom:1px solid rgba(215,160,90,0.14); }
  .quote { margin:0 0 22px; padding:14px 20px; border-left:3px solid ${THEME.tagline}; background:rgba(215,160,90,0.07); border-radius:0 12px 12px 0; font-size:17px; line-height:1.5; color:${THEME.heading}; font-style:italic; text-align:left; }
  .chat { margin:6px 0 18px; text-align:left; }
  .turn { margin:0 0 8px; padding:11px 15px; border-radius:12px; background:${THEME.pageBg}; border:1px solid ${THEME.cardBorder}; font-size:14px; line-height:1.55; color:${THEME.body}; }
  .turn.u { background:rgba(215,160,90,0.09); border-color:rgba(215,160,90,0.32); }
  .who { display:block; font-size:11px; font-weight:800; letter-spacing:1.4px; text-transform:uppercase; color:${THEME.tagline}; margin:0 0 4px; }
  .pre { white-space:pre-wrap; text-align:left; background:${THEME.pageBg}; border:1px solid ${THEME.cardBorder}; border-radius:12px; padding:16px; font-family:${SANS}; font-size:14px; line-height:1.55; color:${THEME.body}; }
  .foot { text-align:center; padding:22px 20px 4px; font-family:${SANS}; font-size:12px; line-height:1.7; color:${THEME.foot}; }
  .foot a { text-decoration:none; color:${THEME.footLink}; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="inner">
        <div class="wordmark">aiASAP</div>
        <!-- G, 2026-09-04: "it is no longer take the leap, change that too."
             This is the tagline the site itself shows under the wordmark -
             the four words G locked on 2026-09-04 22:14 ("take out the , and &"). -->
        <div class="tag">Gorgeous Brilliant Fast Cheap</div>
        ${six}
        <h1>${escapeHtml(args.heading)}</h1>
        ${args.bodyHtml}
      </div>
    </div>
    <div class="foot">
      Sent by 6 at <a href="https://aiASAP.ai">aiASAP.ai</a> &#128155;<br>
      &copy; 2026 aiASAP &middot; DietzX LLC
    </div>
  </div>
</body>
</html>`;
}

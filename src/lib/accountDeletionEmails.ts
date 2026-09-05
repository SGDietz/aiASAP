/**
 * Account-deletion emails (G 2026-06-07) — reuse the G-locked magic-link look
 * (dark-brown radial surround, framed 6 photo, gold text + gold button). Adds a
 * muted secondary button (.btn2) for the "cancel" action. Four stages:
 *   - scheduled  (day 0):   30-day countdown begins + Cancel
 *   - weekBefore (day ~23): 1 week left + Delete-now + Cancel
 *   - dayBefore  (day 29):  1 day left + Cancel
 *   - done       (day 30):  permanently deleted (no buttons)
 * DO NOT change the layout/CSS without G (#1.5.1) — keep in lockstep with the brand.
 */
function shell(title: string, h1: string, bodyHtml: string, buttonsHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${title}</title>
<style>
  body { margin:0; padding:0; background:#0e0803; -webkit-font-smoothing:antialiased; }
  .wrap { width:100%; background: radial-gradient(circle at 50% -8%, #34200f 0%, #1a0f06 50%, #0e0803 100%); background-color:#160c04; padding: 40px 16px; }
  .card { max-width: 540px; margin:0 auto; background:#1d1209; background-color:#1d1209; border:1px solid #4a2f14; border-radius:24px; overflow:hidden; box-shadow:0 24px 70px rgba(0,0,0,.6); }
  .inner { padding: 40px 40px 30px; text-align:center; font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif; }
  .wordmark { font-family:'Arial Black','Archivo Black',Impact,sans-serif; font-style:italic; font-size:36px; letter-spacing:.5px; color:#f4d086; margin:0 0 4px; }
  /* G, 2026-09-04: "it is no longer take the leap" + "all emails should have the top of 6, his face at least". Copy and asset only; layout untouched. Longer tagline needs tighter spacing or it wraps. */
  .tag { font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif; font-size:12px; font-weight:800; letter-spacing:2.2px; text-transform:uppercase; color:#d9a85e; margin:0 0 24px; }
  .sixwrap { display:inline-block; line-height:0; font-size:0; }
  .six { display:block; width:300px; max-width:78%; border-radius:34px; border:1px solid rgba(215,160,90,0.40); background:rgba(0,0,0,0.35); box-shadow:0 0 0 1px rgba(215,160,90,0.45), 0 30px 90px rgba(0,0,0,0.72); margin:0 auto; }
  h1 { font-size:26px; color:#f1c87e; margin:26px 0 12px; font-weight:800; }
  p { font-size:16px; line-height:1.6; margin:0 0 20px; color:#e2bd84; }
  .btn { display:inline-block; margin:8px 6px 4px; padding:16px 40px; border-radius:14px; background:linear-gradient(180deg,#ffda6c 0%,#f3bc53 39%,#c6873a 72%,#915a27 100%); background-color:#f0b84e; color:#3a2108 !important; font-weight:800; font-size:18px; text-decoration:none; box-shadow:0 10px 26px rgba(215,160,90,.4); }
  .btn2 { display:inline-block; margin:8px 6px 4px; padding:15px 36px; border-radius:14px; background:#241608; border:1px solid #6b4621; color:#e2bd84 !important; font-weight:800; font-size:16px; text-decoration:none; }
  .divider { height:1px; width:70%; margin:30px auto 0; background:#4a2f14; }
  .fine { font-size:13px; line-height:1.55; margin-top:22px; color:#a98a63; }
  .foot { text-align:center; padding:22px 20px 4px; font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif; font-size:12px; line-height:1.7; color:#b39a50; }
  .foot a { text-decoration:none; color:#cda966; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="inner">
        <div class="wordmark">aiASAP</div>
        <div class="tag">Cheap. Fast. Gorgeous. Brilliant.</div>
        <span class="sixwrap"><img src="https://wqszxsqzkaatghyrqviv.supabase.co/storage/v1/object/public/email-assets/six_face.png" alt="6, your a-i-buddy" class="six"></span>
        <h1>${h1}</h1>
        ${bodyHtml}
        ${buttonsHtml}
        <div class="divider"></div>
        <p class="fine">You're getting this about the aiASAP account tied to this email address.</p>
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

export function buildDeletionScheduledEmailHtml(
  cancelLink: string,
  purgeDateText: string,
): string {
  return shell(
    "aiASAP — Account scheduled to close",
    "6 Here &mdash; Got It &#128075;",
    `<p>I've started closing your account, like you asked. <b>I'll keep everything safe for 30 days</b> &mdash; until <b>${purgeDateText}</b> &mdash; in case you change your mind, or in case a bad actor hacked your account and you want to recover it. Come back and sign in any time before then and I'll cancel it, no questions asked.</p>
     <p>After ${purgeDateText}, your info is gone for good.</p>`,
    `<a href="${cancelLink}" class="btn">Keep my account &rarr;</a>`,
  );
}

export function buildDeletionWeekBeforeEmailHtml(
  cancelLink: string,
  purgeDateText: string,
): string {
  return shell(
    "aiASAP — 1 week until your data is deleted",
    "6 Here &mdash; One Week Left &#9203;",
    `<p>Just a heads up: your aiASAP account is set to be <b>permanently deleted in one week</b>, on <b>${purgeDateText}</b>. After that, everything is gone for good and can't be brought back.</p>
     <p>Changed your mind? Just tap below to keep your account.</p>`,
    `<a href="${cancelLink}" class="btn">Keep my account &rarr;</a>`,
  );
}

export function buildDeletionDayBeforeEmailHtml(
  cancelLink: string,
  purgeDateText: string,
): string {
  return shell(
    "aiASAP — 1 day until your data is deleted",
    "6 Here &mdash; Last Chance &#9888;&#65039;",
    `<p>This is your final reminder: your aiASAP account and everything in it will be <b>permanently deleted tomorrow</b>, on <b>${purgeDateText}</b>. After that it's gone for good.</p>
     <p>If you want to keep it, just tap below before then.</p>`,
    `<a href="${cancelLink}" class="btn">Keep my account &rarr;</a>`,
  );
}

export function buildDeletionDoneEmailHtml(): string {
  return shell(
    "aiASAP — Your data has been deleted",
    "6 Here &mdash; All Done &#10003;",
    `<p>Your aiASAP account and everything I had saved for you have been <b>permanently deleted</b>, just like you wanted. There's nothing left on my end &mdash; it's a clean slate.</p>
     <p>It was good knowing you. If you ever want to come back, you're always welcome to start fresh. Take care. &#128155;</p>`,
    ``,
  );
}

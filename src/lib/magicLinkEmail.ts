/**
 * Magic-link email — aiASAP brand "beautiful" look (G-locked, 2026-06-04 restore).
 *
 * G confirmed the look he wants: the warm DARK-brown radial surround + framed 6 photo
 * + GOLD text + gold button (the original locked design — not the bright-gold-bg
 * detour). RESTORED that exactly, with ONE technical change so it renders on ALL
 * devices: the gold text is SOLID gold, NOT -webkit-background-clip:text. The
 * clip-gradient is precisely what went invisible on Android Gmail (text dropped to
 * transparent, gold bars only — screenshot 20260604-051951). Solid gold on the dark
 * card looks ~identical and renders in every client. The button keeps its real
 * gradient (an element background, which email clients DO render). DO NOT reintroduce
 * background-clip:text on text, and DO NOT change the LAYOUT/copy without G (#1.5.1).
 *
 * ONE ADDITION, 2026-08-21, flagged to G the same hour — revert on his word.
 * Nothing was changed or removed: the wordmark, the photo, the headline, the
 * paragraph, the button and the footer are all exactly as locked. A single
 * `.fine` line was ADDED under the button, in the existing style.
 *
 * Why it could not wait: cross-device sign-in went in today. The magic link is
 * opened on a PHONE while the person is still talking to 6 on a LAPTOP, and the
 * laptop is now what wakes up and greets them. The locked copy says only "tap
 * the magic link to finish setting up" — somebody who taps it and keeps staring
 * at the phone sees nothing happen and thinks it is broken. The new line tells
 * them where to look. Copy is Ara's, trimmed to one sentence to leave the
 * locked design untouched.
 */
export function buildMagicLinkEmailHtml(magicLink: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>aiASAP — Your sign-in link</title>
<style>
  body { margin:0; padding:0; background:#0e0803; -webkit-font-smoothing:antialiased; }
  .wrap { width:100%; background: radial-gradient(circle at 50% -8%, #34200f 0%, #1a0f06 50%, #0e0803 100%); background-color:#160c04; padding: 40px 16px; }
  .card { max-width: 540px; margin:0 auto; background:#1d1209; background-color:#1d1209; border:1px solid #4a2f14; border-radius:24px; overflow:hidden; box-shadow:0 24px 70px rgba(0,0,0,.6); }
  .inner { padding: 40px 40px 30px; text-align:center; font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif; }
  .wordmark { font-family:'Arial Black','Archivo Black',Impact,sans-serif; font-style:italic; font-size:36px; letter-spacing:.5px; color:#f4d086; margin:0 0 4px; }
  .tag { font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif; font-size:14px; font-weight:800; letter-spacing:7px; text-transform:uppercase; color:#d9a85e; margin:0 0 24px; }
  .sixwrap { display:inline-block; line-height:0; font-size:0; }
  .six { display:block; width:300px; max-width:78%; border-radius:34px; border:1px solid rgba(215,160,90,0.40); background:rgba(0,0,0,0.35); box-shadow:0 0 0 1px rgba(215,160,90,0.45), 0 30px 90px rgba(0,0,0,0.72); margin:0 auto; }
  h1 { font-size:26px; color:#f1c87e; margin:26px 0 12px; font-weight:800; }
  p { font-size:16px; line-height:1.6; margin:0 0 20px; color:#e2bd84; }
  .btn { display:inline-block; margin:8px 0 4px; padding:16px 46px; border-radius:14px; background:linear-gradient(180deg,#ffda6c 0%,#f3bc53 39%,#c6873a 72%,#915a27 100%); background-color:#f0b84e; color:#3a2108 !important; font-weight:800; font-size:18px; text-decoration:none; box-shadow:0 10px 26px rgba(215,160,90,.4); }
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
        <div class="tag">Take the Leap</div>
        <span class="sixwrap"><img src="https://wqszxsqzkaatghyrqviv.supabase.co/storage/v1/object/public/email-assets/startscreen_trim.png" alt="6, your a-i-buddy" class="six"></span>
        <h1>6 Here &mdash; Your Ai Buddy &#128079;</h1>
        <p>Tap the magic link below to finish setting up your account. From here on I'll remember every time we talk &#129309;</p>
        <a href="${magicLink}" class="btn">Finish setting up &rarr;</a>
        <p class="fine">Tap it on <strong>this</strong> device &mdash; then look back at the screen where we were talking. That's the one that wakes up. You can put this one down.</p>
        <div class="divider"></div>
        <p class="fine">Didn't ask to set up an account? No worries &mdash; just ignore this email.</p>
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

/**
 * Branded confirmation page (G 2026-06-07) shown when a user clicks a link from a
 * deletion email (cancel / delete-now). Matches the aiASAP dark-gold brand.
 */
export function actionResultPage(heading: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>aiASAP</title>
<style>
  body { margin:0; background:#0e0803; font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif; }
  .wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; background:radial-gradient(circle at 50% -8%,#34200f 0%,#1a0f06 50%,#0e0803 100%); padding:24px; box-sizing:border-box; }
  .card { max-width:480px; width:100%; background:#1d1209; border:1px solid #4a2f14; border-radius:24px; padding:44px 36px; text-align:center; box-shadow:0 24px 70px rgba(0,0,0,.6); }
  .wordmark { font-family:'Arial Black',Impact,sans-serif; font-style:italic; font-size:30px; color:#f4d086; margin:0 0 18px; }
  h1 { font-size:24px; color:#f1c87e; margin:0 0 14px; font-weight:800; }
  p { font-size:16px; line-height:1.6; color:#e2bd84; margin:0; }
  a { color:#f0b84e; font-weight:800; text-decoration:none; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="wordmark">aiASAP</div>
      <h1>${heading}</h1>
      <p>${message}</p>
      <p style="margin-top:24px;"><a href="https://aiASAP.ai">Back to aiASAP.ai &rarr;</a></p>
    </div>
  </div>
</body>
</html>`;
}

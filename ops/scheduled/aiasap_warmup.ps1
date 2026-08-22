# aiASAP dev-server WARM-UP (2026-08-21). Why: the always-on server runs `next dev`,
# which compiles each page/API route on its FIRST request. G's 08:07 ride: 6 took
# ~35 s to answer "are you there?" because the session routes compiled on his tap.
# This hits the page and every session-path route once so they are compiled before
# anyone taps.
#
# WHY IT IS SAFE, precisely (audited 2026-08-21): 16 of the 17 API paths export
# ONLY POST, and Next's dispatcher answers a GET with 405 without ever entering
# the handler body — so no session is minted, no row written, no provider called.
# The one exception is /api/account/me, which DOES have a GET and does run: it
# is still safe because Invoke-WebRequest sends no auth cookie, so userEmail
# stays null, the sb.auth.updateUser branch is unreachable, and control falls to
# the anonymous 200.
#
# NOTE the page request: "/" auto-starts a LiveAvatar session in a BROWSER
# (LiveAvatarDemo.tsx:101-122). This warm-up is not a browser — it fetches the
# server-rendered HTML and never executes the client bundle, so no useEffect
# runs and nothing mints. Never point a real browser at 3001 to "warm it up".
param([int]$Port = 3001, [int]$WaitSeconds = 180)
$log = 'C:\Users\sgdie\Documents\Claude\Scheduled\aiasap_dev_3001.log'
function Log($m) { Add-Content -Path $log -Value ("{0}  warmup: {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m) -Encoding utf8 }

$deadline = (Get-Date).AddSeconds($WaitSeconds)
while ((Get-Date) -lt $deadline -and -not (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)) { Start-Sleep -Seconds 2 }
if (-not (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)) { Log "port $Port never came up - skipped"; exit 0 }

$paths = @(
  '/',
  '/api/v1/sessions/start', '/api/start-session', '/api/start-custom-session',
  '/api/prompt-brain', '/api/openai-chat-complete', '/api/elevenlabs-text-to-speech',
  '/api/voice-mode/log-turn', '/api/conversation/log', '/api/app-events/log',
  '/api/liveavatar/session-transcript/sync', '/api/keep-session-alive',
  '/api/v1/sessions/keep-alive', '/api/v1/sessions/stop', '/api/stop-session',
  '/api/transcription/capture', '/api/voice-transcribe', '/api/account/me'
)
# Single-instance guard, placed AFTER the port wait on purpose: if it sat above
# the wait, a stale warm-up still blocking on a dead port would starve the real
# one for up to 180 s — the exact crash-loop case this is meant to survive.
# The match is anchored to the real "-File <path>\aiasap_warmup.ps1" launch form
# so a shell that merely MENTIONS the filename (an operator running Get-Content,
# say) can never be mistaken for a running warm-up.
$others = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -match '-File\s+"?[A-Za-z]:\\[^"]*\\aiasap_warmup\.ps1' -and $_.ProcessId -ne $PID })
if ($others.Count -gt 0) {
  Log ("another warm-up is already running (pid {0}) - skipping" -f ($others[0].ProcessId))
  exit 0
}

$sw = [Diagnostics.Stopwatch]::StartNew()
$done = @()
foreach ($p in $paths) {
  $t = [Diagnostics.Stopwatch]::StartNew()
  try { $r = Invoke-WebRequest -Uri "http://127.0.0.1:$Port$p" -Method GET -UseBasicParsing -TimeoutSec 90; $code = $r.StatusCode }
  catch { $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 'ERR' } }
  $done += "$p=$code/$([int]$t.Elapsed.TotalMilliseconds)ms"
}
Log ("done in {0}s: {1}" -f [int]$sw.Elapsed.TotalSeconds, ($done -join ' '))
exit 0

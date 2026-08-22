# aiASAP dev server — always-on launcher (2026-08-21).
# Run by Windows Scheduled Task "aiASAP-Dev-3001" at G's logon, under
# conhost.exe --headless so no window ever shows (Windows Terminal ignores
# -WindowStyle Hidden). Mirrors the proven WildWorks-Site-3020 recipe.
#
# Server-only. Nothing here opens a browser.
#
# MONEY, CORRECTED 2026-08-21 (the old comment here was WRONG and I relied on
# it): loading "/" in ANY browser AUTO-STARTS a LiveAvatar session. There is no
# tap gate — src\components\LiveAvatarDemo.tsx:101-122 calls startSession() from
# a useEffect on mount, and awaitReturnTap defaults to false (:48). The tap
# gate people remember is INSIDE the live view, after the session already
# exists. So: the SERVER is free and idle costs nothing, but pointing any
# browser at 3001 costs real money the moment the page loads.
# To look at a screen safely, hold the page's own bootstrap POST inside Chrome
# with CDP Fetch.enable (requestStage "Request", pattern *start-custom-session*)
# and never continue it. Do NOT block that URL — a block drops the app to a
# bare Retry screen that proves nothing.
#
# Self-heal: if node exits, relaunch after 5s. Five quick deaths in a row
# (< 30s each) = something is really broken -> exit 1 so the task's own
# restart policy (10x / 1 min) takes over instead of a hot loop.

$ErrorActionPreference = 'Continue'
$repo = 'C:\Users\sgdie\Documents\Claude\projects\ai-asap-may06-prod'
$node = 'C:\Users\sgdie\AppData\Local\Programs\nodejs\node.exe'
$next = Join-Path $repo 'node_modules\next\dist\bin\next'
$port = 3001
$log  = 'C:\Users\sgdie\Documents\Claude\Scheduled\aiasap_dev_3001.log'

function Log($m) {
  $line = "{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m
  Add-Content -Path $log -Value $line -Encoding utf8
}

# Keep the log from growing forever (5 MB cap -> keep the tail).
if ((Test-Path $log) -and ((Get-Item $log).Length -gt 5MB)) {
  $tail = Get-Content $log -Tail 2000
  Set-Content -Path $log -Value $tail -Encoding utf8
}

Log "launcher start (pid $PID)"

if (-not (Test-Path $node)) { Log "FATAL node missing at $node"; exit 1 }
if (-not (Test-Path $next)) { Log "FATAL next missing at $next"; exit 1 }

# Already serving? Then another instance owns the port — nothing to do.
$busy = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
if ($busy) {
  Log "port $port already listening (pid $($busy[0].OwningProcess)) - exiting clean"
  exit 0
}

# Same env the hand-run dev server always used (kills localhost HTTP 431).
$env:NODE_OPTIONS = '--max-http-header-size=131072'
$env:NODE_ENV = $null
Set-Location $repo

# Node's own output goes to its own files as raw UTF-8 (PowerShell's *>>
# would write UTF-16 and make the log unreadable).
$outLog = $log -replace '\.log$', '.out.log'
$errLog = $log -replace '\.log$', '.err.log'

$quickDeaths = 0
while ($true) {
  $started = Get-Date
  Log "starting: next dev --port $port  (stdout -> $outLog, stderr -> $errLog)"
  # Warm-up runs beside the server (detached, headless): compiles the page +
  # session routes once so the first real tap is not a 35 s cold compile.
  # -PassThru + a logged pid: a Start-Process that silently fails to launch the
  # child would otherwise leave NO evidence for up to four minutes.
  try {
    # Launch under conhost's headless mode.  WindowStyle Hidden alone can still
    # flash a PowerShell console while Windows Terminal is handling the host.
    $w = Start-Process -FilePath 'conhost.exe' -PassThru `
      -ArgumentList @('--headless','powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File','C:\Users\sgdie\Documents\Claude\Scheduled\aiasap_warmup.ps1','-Port',"$port")
    Log "warmup spawned pid $($w.Id)"
  } catch { Log "warmup spawn failed: $($_.Exception.Message)" }
  $p = Start-Process -FilePath $node -ArgumentList @($next, 'dev', '--port', "$port") `
         -WorkingDirectory $repo -NoNewWindow -Wait -PassThru `
         -RedirectStandardOutput $outLog -RedirectStandardError $errLog
  $code = $p.ExitCode
  $alive = ((Get-Date) - $started).TotalSeconds
  Log "next dev exited code=$code after $([int]$alive)s"

  if ($alive -lt 30) { $quickDeaths++ } else { $quickDeaths = 0 }
  if ($quickDeaths -ge 5) {
    Log "5 quick deaths in a row - giving up to the task restart policy"
    exit 1
  }
  Start-Sleep -Seconds 5
}

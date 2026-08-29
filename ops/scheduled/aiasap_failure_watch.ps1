# aiASAP FAILURE WATCH — THIRD LEG.
#
# REWRITTEN 2026-08-21 after G's correction: "The laptop is off eighty percent
# of the time. So it cannot be counted on for anything. We want everything set
# up cloud based first and foremost."
#
# He is right, and what this script used to do was wrong. It checked
# error_logs, high-severity app_events and whether 6 had gone mute — all three
# of which /api/cron/health now does from Vercel, every 15 minutes, on a
# machine that is always on. Two watchers checking the same things means TWO
# Telegram messages for one problem, and two "all clear" messages a day. That
# is how somebody learns to stop reading their alerts, which costs more than
# having no alerts at all.
#
# So this no longer watches the app. IT WATCHES THE WATCHER.
#
# The cloud watcher cannot detect its own death. If Vercel stops running the
# cron, the silence looks exactly like good news. Only something OUTSIDE Vercel
# can catch that — and being somewhere else is the one job a sometimes-on
# laptop does better than the cloud. It checks two things nothing else can:
#
#   1. Is the cloud watcher still stamping its heartbeat?
#   2. Is the local dev server on :3001 still up?
#
# It is SILENT otherwise. No daily heartbeat of its own — the cloud watcher
# already sends one, and a second would be the same noise problem in a new coat.
#
# READ-ONLY against Supabase. Every call is a GET.

$ErrorActionPreference = 'Continue'

$repo      = 'C:\Users\sgdie\Documents\Claude\projects\ai-asap-may06-prod'
$logDir    = 'C:\Users\sgdie\Documents\Claude\Scheduled'
$logFile   = Join-Path $logDir 'aiasap_failure_watch.log'
$stateFile = Join-Path $logDir 'aiasap_failure_watch.state.json'

# The cloud cron runs every 15 minutes. Three misses before shouting: one
# skipped run is a Vercel hiccup, three in a row is a watcher that has stopped.
$HEARTBEAT_STALE_MINUTES = 50
# Do not repeat the same finding every 15 minutes. Once every four hours is
# enough to stay noticed without becoming wallpaper.
$REALERT_HOURS = 4
# How long a heartbeat may be missing on a FRESH install before its absence is
# itself a finding. Chief's catch, 2026-08-21: treating "never seen" as
# permanently silent means a cron that deploys and never fires disappears
# forever - broken onboarding looks identical to not-installed-yet.
$NEVER_SEEN_GRACE_HOURS = 2

function Log($m) {
  Add-Content -Path $logFile -Value ("[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m) -Encoding utf8
}

# ---------------------------------------------------------------- env loading
$envPath = Join-Path $repo '.env'
if (-not (Test-Path -LiteralPath $envPath)) { Log "FATAL: .env not found at $envPath"; exit 2 }
$envValues = @{}
foreach ($line in Get-Content -LiteralPath $envPath) {
  if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
  $k, $v = $line -split '=', 2
  $envValues[$k.Trim()] = $v.Trim().Trim('"')
}

$supaUrl = $envValues['SUPABASE_URL']
$supaKey = $envValues['SUPABASE_SERVICE_ROLE_KEY']

# TELEGRAM_BOT_TOKEN in aiASAP's .env is DEAD — getMe returns 401. The live bot
# token lives in the Windows USER environment as CLAUDE_TG_BOT_TOKEN. Prefer
# that; keep .env only as a fallback in case it is ever repaired.
$tgToken = [Environment]::GetEnvironmentVariable('CLAUDE_TG_BOT_TOKEN', 'User')
if (-not $tgToken) { $tgToken = $envValues['TELEGRAM_BOT_TOKEN'] }
$tgChat  = ($envValues['TELEGRAM_ALLOWED_USER_IDS'] -split ',')[0].Trim()

# Never echoed. Presence only.
if (-not $supaUrl -or -not $supaKey) { Log 'FATAL: Supabase env missing'; exit 2 }
if (-not $tgToken -or -not $tgChat)  { Log 'FATAL: Telegram env missing';  exit 2 }

# ------------------------------------------------------------------ state
# PS 5.1 turns JSON into a PSCustomObject, not a hashtable, so read fields
# explicitly rather than indexing.
$lastAlert = [datetime]'2000-01-01'
# Once a heartbeat has EVER been seen, "never seen" becomes impossible and any
# absence is staleness. Until then, expectingSince anchors the grace window.
$everSeen       = $false
$expectingSince = $null
if (Test-Path -LiteralPath $stateFile) {
  try {
    $st = Get-Content -LiteralPath $stateFile -Raw -Encoding utf8 | ConvertFrom-Json
    if ($st.lastAlertUtc)      { $lastAlert = [datetime]$st.lastAlertUtc }
    if ($st.everSeenHeartbeat) { $everSeen  = [bool]$st.everSeenHeartbeat }
    if ($st.expectingSinceUtc) { $expectingSince = [datetime]$st.expectingSinceUtc }
  } catch { Log "state unreadable: $_" }
}

# Returns a hashtable, NOT an array. Deliberate and load-bearing: PowerShell
# collapses an EMPTY array to $null on return, so a function returning @() for
# "no rows" is indistinguishable from $null for "the query failed". The first
# version of this script did exactly that and cried CANNOT REACH SUPABASE on
# every clean run — a false alarm that trains G to ignore real ones.
function Get-Rows($path) {
  try {
    $r = Invoke-RestMethod -Method GET -Uri "$supaUrl/rest/v1/$path" -Headers @{
      apikey        = $supaKey
      Authorization = "Bearer $supaKey"
      Accept        = 'application/json'
    } -TimeoutSec 30
    return @{ ok = $true; rows = @($r) }
  } catch {
    Log "query failed [$path]: $($_.Exception.Message)"
    return @{ ok = $false; rows = @() }
  }
}

$alerts = @()
$lines  = @()

# ---------- 1. IS THE CLOUD WATCHER STILL ALIVE? -----------------------------
# The whole reason this script still exists.
$hbQ = Get-Rows ("app_events?select=created_at&event_type=eq.cloud_watch_heartbeat" +
                 "&order=created_at.desc&limit=1")

if (-not $hbQ.ok) {
  # Cannot reach Supabase from here. Say so plainly rather than guessing — but
  # note this is a LOCAL network problem as often as a real outage, so it is
  # worded as "from this machine", not "the site is down".
  $alerts += "CANNOT REACH SUPABASE from this machine. Cannot tell whether the cloud watcher is alive."
} elseif ($hbQ.rows.Count -eq 0) {
  # FOUR STATES, not two. Chief's counter-challenge, and he was right:
  #   not expected yet        -> silent (grace window still open)
  #   expected but NEVER seen -> ALERT, this is broken onboarding
  #   healthy                 -> silent
  #   seen before, now gone   -> ALERT
  # Collapsing the first two is what lets a cron that deployed and never fired
  # vanish permanently, which is the exact failure a watchdog exists to catch.
  if ($everSeen) {
    $alerts += "THE CLOUD WATCHER HAS STOPPED. Its heartbeat used to arrive and there is now no trace of it at all."
  } else {
    if (-not $expectingSince) { $expectingSince = (Get-Date).ToUniversalTime() }
    $waitedH = ((Get-Date).ToUniversalTime() - $expectingSince).TotalHours
    if ($waitedH -ge $NEVER_SEEN_GRACE_HOURS) {
      $alerts += ("THE CLOUD WATCHER HAS NEVER REPORTED IN - expected for {0:N1} hours and no heartbeat has EVER arrived." -f $waitedH)
      $alerts += "It deployed and is not running, or was never wired up. Nothing is watching aiASAP."
    } else {
      $lines += ("no cloud heartbeat yet, {0:N1}h into a {1}h grace window" -f $waitedH, $NEVER_SEEN_GRACE_HOURS)
      Log "no heartbeat rows yet; inside grace window. Silent by design."
    }
  }
} else {
  # Seeing one closes the never-seen question permanently.
  $everSeen = $true
  $expectingSince = $null
  $beatUtc = [datetime]::Parse($hbQ.rows[0].created_at).ToUniversalTime()
  $ageMin  = [int]((Get-Date).ToUniversalTime() - $beatUtc).TotalMinutes
  $lines  += "cloud heartbeat ${ageMin}m ago"
  if ($ageMin -gt $HEARTBEAT_STALE_MINUTES) {
    $alerts += "THE CLOUD WATCHER HAS STOPPED. Last heartbeat ${ageMin} minutes ago (expected every 15)."
    $alerts += "Nothing is watching aiASAP right now. Check the Vercel cron before anything else."
  }
}

# ---------- 2. is the local dev server still up? -----------------------------
# Genuinely local — nothing in the cloud can see :3001. A plain HTTP GET is FREE
# and mints nothing. NEVER open this in a browser: a page load starts a paid
# session on its own, with no tap.
try {
  $resp = Invoke-WebRequest -Uri 'http://127.0.0.1:3001/' -UseBasicParsing -TimeoutSec 15
  $lines += "dev :3001 HTTP $($resp.StatusCode)"
  if ($resp.StatusCode -ne 200) { $alerts += "dev server on :3001 answered HTTP $($resp.StatusCode)" }
} catch {
  $alerts += "dev server on :3001 is DOWN ($($_.Exception.Message))"
}

# ------------------------------------------------------------------ report
function Send-Telegram($text) {
  try {
    $body = @{ chat_id = $tgChat; text = $text; disable_web_page_preview = $true } | ConvertTo-Json -Compress
    Invoke-RestMethod -Method POST -Uri "https://api.telegram.org/bot$tgToken/sendMessage" `
      -ContentType 'application/json; charset=utf-8' `
      -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 20 | Out-Null
    return $true
  } catch {
    Log "telegram send failed: $($_.Exception.Message)"
    return $false
  }
}

$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm'
if ($alerts.Count -gt 0) {
  $hoursSince = ((Get-Date) - $lastAlert).TotalHours
  if ($hoursSince -ge $REALERT_HOURS) {
    $msg = "aiASAP BACKSTOP - something is wrong.`n`n" +
           (($alerts | ForEach-Object { "- $_" }) -join "`n") +
           "`n`n$stamp Eastern`nThis is the local backstop, not the cloud watcher."
    $sent = Send-Telegram $msg
    if ($sent) { $lastAlert = Get-Date }
    Log "ALERTS($($alerts.Count)) sent=$sent :: $($alerts -join ' | ')"
  } else {
    Log "ALERTS($($alerts.Count)) held (last sent $([int]$hoursSince)h ago) :: $($alerts -join ' | ')"
  }
} else {
  # Silent on purpose. The cloud watcher owns the daily all-clear; a second one
  # from here would be the same noise problem this rewrite exists to fix.
  Log "clean :: $($lines -join ' | ')"
}

$state = @{
  lastAlertUtc      = $lastAlert.ToString('o')
  everSeenHeartbeat = $everSeen
  expectingSinceUtc = $(if ($expectingSince) { $expectingSince.ToString('o') } else { $null })
}
$state | ConvertTo-Json | Set-Content -Path $stateFile -Encoding utf8
exit 0

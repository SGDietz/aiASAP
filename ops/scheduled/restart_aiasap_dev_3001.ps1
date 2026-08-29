# Clean restart of the always-on aiASAP dev server (task "aiASAP-Dev-3001").
# Why a helper: Stop-ScheduledTask kills the launcher but can leave the child
# node.exe alive holding port 3001 (the WildWorks orphan-node lesson). A stale
# orphan serves old code through a healthy-looking 200. This script:
#   1. stops the task
#   2. kills anything still listening on 3001
#   3. proves the port is clear
#   4. starts the task again
#   5. waits for the port, then proves HTTP 200 on /
# Server-only. Opens no browser. Mints no 6.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File restart_aiasap_dev_3001.ps1

$ErrorActionPreference = 'Continue'
$name = 'aiASAP-Dev-3001'
$port = 3001

function Say($m) { Write-Output ("{0}  {1}" -f (Get-Date -Format 'HH:mm:ss'), $m) }

Say "stopping task $name"
Stop-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Stop-ScheduledTask kills ONLY the top conhost. The launcher powershell and
# its node family survive it (proven 2026-08-21: the console-less launcher
# kept relaunching node, which died instantly with 0xC0000142). Kill the
# whole family by command line, launcher first so it cannot relaunch.
# Match ONLY the real launcher form ("-File <path>\aiasap_dev_3001.ps1"), never
# a shell that merely mentions the path (2026-08-21: a loose match killed the
# operator's own shell). Also never this process or its parent.
$me = Get-CimInstance Win32_Process -Filter "ProcessId=$PID"
$launchers = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
             Where-Object { $_.CommandLine -match '-File\s+"?[A-Za-z]:\\[^"]*\\aiasap_dev_3001\.ps1' -and
                            $_.ProcessId -ne $PID -and $_.ProcessId -ne $me.ParentProcessId }
foreach ($l in $launchers) { Say "killing launcher pid $($l.ProcessId)"; Stop-Process -Id $l.ProcessId -Force -ErrorAction SilentlyContinue }
# A warm-up that survives the restart would make the NEW launcher's warm-up skip
# itself (single-instance guard), so the fresh server would never get warmed.
# Same anchored match as the guard uses.
$warmups = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
           Where-Object { $_.CommandLine -match '-File\s+"?[A-Za-z]:\\[^"]*\\aiasap_warmup\.ps1' -and
                          $_.ProcessId -ne $PID -and $_.ProcessId -ne $me.ParentProcessId }
foreach ($w in $warmups) { Say "killing stale warm-up pid $($w.ProcessId)"; Stop-Process -Id $w.ProcessId -Force -ErrorAction SilentlyContinue }
$family = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
          Where-Object { $_.CommandLine -match 'ai-asap-may06-prod\\node_modules\\next' }
foreach ($n in $family) { Say "killing aiASAP node pid $($n.ProcessId)"; Stop-Process -Id $n.ProcessId -Force -ErrorAction SilentlyContinue }
$orphans = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue |
           Select-Object -ExpandProperty OwningProcess -Unique
foreach ($pid_ in $orphans) {
  $p = Get-Process -Id $pid_ -ErrorAction SilentlyContinue
  if ($p) { Say "killing orphan on ${port}: pid $pid_ ($($p.ProcessName))"; Stop-Process -Id $pid_ -Force -ErrorAction SilentlyContinue }
}
$deadline = (Get-Date).AddSeconds(15)
while ((Get-Date) -lt $deadline -and (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)) { Start-Sleep -Milliseconds 500 }
if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) { Say "FAIL: port $port still held"; exit 2 }
Say "port $port clear"

Say "starting task $name"
Start-ScheduledTask -TaskName $name
$deadline = (Get-Date).AddSeconds(120)
$up = $false
while ((Get-Date) -lt $deadline) {
  if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) { $up = $true; break }
  Start-Sleep -Seconds 2
}
if (-not $up) { Say "FAIL: port $port never came up"; exit 3 }
$pid2 = (Get-NetTCPConnection -State Listen -LocalPort $port | Select-Object -First 1).OwningProcess
Say "port $port listening, pid $pid2"

try {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $r = Invoke-WebRequest -Uri "http://127.0.0.1:$port/" -UseBasicParsing -TimeoutSec 180
  $sw.Stop()
  Say "HTTP $($r.StatusCode) on / in $([int]$sw.Elapsed.TotalSeconds)s ($($r.RawContentLength) bytes)"
} catch {
  Say "FAIL: HTTP error $($_.Exception.Message)"; exit 4
}

# A 200 root is not sufficient: a dev listener can outlive a production build
# and keep serving HTML whose generated JS/CSS files no longer exist. That
# renders a raw, unhydrated page while every superficial root probe stays green.
# Require the complete HTML-referenced Next asset graph before calling the
# protected runtime healthy.
$assetRefs = @([regex]::Matches(
  [string]$r.Content,
  '(?:src|href)="(?<url>/_next/static/[^"?#]+)'
) | ForEach-Object { $_.Groups['url'].Value } | Sort-Object -Unique)
if ($assetRefs.Count -eq 0) {
  Say "FAIL: root HTML references no Next JS/CSS assets"; exit 5
}
$assetFailures = @()
foreach ($assetRef in $assetRefs) {
  try {
    $asset = Invoke-WebRequest -Uri "http://127.0.0.1:$port$assetRef" -UseBasicParsing -TimeoutSec 60
    if ($asset.StatusCode -ne 200) { $assetFailures += "$assetRef=$($asset.StatusCode)" }
  } catch {
    $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 'ERR' }
    $assetFailures += "$assetRef=$status"
  }
}
if ($assetFailures.Count -gt 0) {
  Say "FAIL: referenced asset graph is incomplete: $($assetFailures -join ', ')"; exit 5
}
Say "asset graph $($assetRefs.Count)/$($assetRefs.Count) HTTP 200"
$i = Get-ScheduledTaskInfo -TaskName $name
Say "task state=$((Get-ScheduledTask -TaskName $name).State) lastRun=$($i.LastRunTime) result=$($i.LastTaskResult)"
Say "OK"
exit 0

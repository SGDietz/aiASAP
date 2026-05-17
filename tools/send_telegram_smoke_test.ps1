param(
  [Parameter(Mandatory = $true)]
  [string]$Commit,

  [string]$Url = "https://ai-asap.vercel.app",

  [string]$Message = ""
)

$ErrorActionPreference = "Stop"

$envPath = Join-Path (Split-Path -Parent $PSScriptRoot) ".env"
if (-not (Test-Path -LiteralPath $envPath)) {
  throw ".env not found at $envPath"
}

$envValues = @{}
foreach ($line in Get-Content -LiteralPath $envPath) {
  if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
  $key, $value = $line -split '=', 2
  $envValues[$key.Trim()] = $value.Trim()
}

$token = $envValues["TELEGRAM_BOT_TOKEN"]
$allowedIds = $envValues["TELEGRAM_ALLOWED_USER_IDS"]

if (-not $token) {
  throw "TELEGRAM_BOT_TOKEN is missing in .env"
}
if (-not $allowedIds) {
  throw "TELEGRAM_ALLOWED_USER_IDS is missing in .env"
}

$chatIds = @(
  $allowedIds -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ }
)
$chatId = $chatIds[0]
if (-not $chatId) {
  throw "No Telegram chat id found in TELEGRAM_ALLOWED_USER_IDS"
}

$telegramText = "Smoke test $Commit`nPreview: $Url"
if ($Message.Trim()) {
  $telegramText = "$telegramText`n$Message"
}
$body = @{
  chat_id = $chatId
  text = $telegramText
  disable_web_page_preview = "false"
}

Invoke-RestMethod `
  -Uri "https://api.telegram.org/bot$token/sendMessage" `
  -Method Post `
  -ContentType "application/x-www-form-urlencoded" `
  -Body $body | Out-Null

Write-Host "Sent Telegram smoke test link."

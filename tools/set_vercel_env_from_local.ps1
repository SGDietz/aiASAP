param(
  [string]$ProjectName = "ai-asap"
)

$ErrorActionPreference = "Stop"

function Read-DotEnv([string]$Path) {
  $map = @{}
  if (!(Test-Path $Path)) {
    throw ".env file not found"
  }
  foreach ($line in Get-Content $Path) {
    if (!$line -or $line.Trim().StartsWith("#") -or $line -notmatch "=") {
      continue
    }
    $idx = $line.IndexOf("=")
    $key = $line.Substring(0, $idx).Trim()
    $value = $line.Substring($idx + 1).Trim()
    if ($key) {
      $map[$key] = $value
    }
  }
  return $map
}

$envMap = Read-DotEnv ".env"
$requiredKeys = @("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")
$optionalKeys = @(
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "OPENAI_WEB_SEARCH_MODEL",
  "OPENAI_PROMPT_BRAIN_MODEL",
  "NEXT_PUBLIC_SITE_URL",
  "RESEND_API_KEY",
  "ACCOUNT_LINK_FROM_EMAIL",
  "BUG_REPORT_FROM_EMAIL",
  "AIASAP_FOUNDER_REPORT_EMAIL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_OAUTH_REDIRECT_URI",
  "SOCIAL_YOUTUBE_REDIRECT_URI",
  "META_APP_ID",
  "META_APP_SECRET",
  "META_REDIRECT_URI",
  "X_CLIENT_ID",
  "X_CLIENT_SECRET",
  "X_REDIRECT_URI",
  "THREADS_CLIENT_ID",
  "THREADS_CLIENT_SECRET",
  "THREADS_REDIRECT_URI",
  "TIKTOK_CLIENT_KEY",
  "TIKTOK_CLIENT_SECRET",
  "TIKTOK_REDIRECT_URI",
  "LIVEAVATAR_VOICE_ID",
  "LIVEAVATAR_API_KEY",
  "LIVEAVATAR_API_URL",
  "LIVEAVATAR_AVATAR_ID",
  "LIVEAVATAR_CONTEXT_ID",
  "LIVEAVATAR_LANGUAGE",
  "LIVEAVATAR_VERIFY_VOICE_PREVIEW",
  "LIVEAVATAR_FALLBACK_VOICE_ID",
  "LIVEAVATAR_DAILY_CREDIT_LIMIT",
  "LIVEAVATAR_CREDITS_PER_MINUTE",
  "LIVEAVATAR_MAX_SESSION_MINUTES",
  "LIVEAVATAR_CREDIT_LIMIT_DISABLED",
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_VOICE_ID"
)
foreach ($key in $requiredKeys) {
  if (!$envMap.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($envMap[$key])) {
    throw "$key missing from .env"
  }
}

$token = [System.Environment]::GetEnvironmentVariable("VERCEL_TOKEN")
if ([string]::IsNullOrWhiteSpace($token)) {
  throw "VERCEL_TOKEN missing from machine environment"
}

$headers = @{
  Authorization = "Bearer $token"
  "Content-Type" = "application/json"
}

$projects = Invoke-RestMethod -Method GET -Uri "https://api.vercel.com/v9/projects?limit=100" -Headers $headers
$project = $projects.projects | Where-Object { $_.name -eq $ProjectName } | Select-Object -First 1
if (!$project) {
  throw "Vercel project not found: $ProjectName"
}

$teamId = $project.accountId
$projectId = $project.id
$baseUri = "https://api.vercel.com/v10/projects/$projectId/env?teamId=$teamId"

$existing = Invoke-RestMethod -Method GET -Uri $baseUri -Headers $headers
$keysToSet = @($requiredKeys)
foreach ($key in $optionalKeys) {
  if ($envMap.ContainsKey($key) -and ![string]::IsNullOrWhiteSpace($envMap[$key])) {
    $keysToSet += $key
  }
}

foreach ($key in $keysToSet) {
  $matches = @($existing.envs | Where-Object { $_.key -eq $key })
  foreach ($item in $matches) {
    $deleteUri = "https://api.vercel.com/v9/projects/$projectId/env/$($item.id)?teamId=$teamId"
    Invoke-RestMethod -Method DELETE -Uri $deleteUri -Headers $headers | Out-Null
  }

  $body = @{
    key = $key
    value = $envMap[$key]
    type = "encrypted"
    target = @("production", "preview", "development")
  } | ConvertTo-Json

  Invoke-RestMethod -Method POST -Uri $baseUri -Headers $headers -Body $body | Out-Null
  Write-Output "$key=set"
}

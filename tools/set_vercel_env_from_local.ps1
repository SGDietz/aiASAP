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
foreach ($key in $requiredKeys) {
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

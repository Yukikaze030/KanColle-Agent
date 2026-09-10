# Install poi-plugin-kancolle-mcp into local Poi
# Usage: powershell -File scripts/install-poi-plugin.ps1

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$pkg = Join-Path $repo 'packages\poi-plugin-mcp'
$bundle = Join-Path $pkg 'dist\poi-bundle.cjs'
$poiPlugins = Join-Path $env:APPDATA 'poi\plugins'
$target = Join-Path $poiPlugins 'node_modules\poi-plugin-kancolle-mcp'

if (-not (Test-Path $poiPlugins)) {
  throw "Poi plugins dir not found: $poiPlugins"
}
if (-not (Test-Path $bundle)) {
  Write-Host 'Building poi-plugin-kancolle-mcp...'
  Push-Location $repo
  npm run build -w @kancolle-agent/shared
  npm run build -w poi-plugin-kancolle-mcp
  Pop-Location
}
if (-not (Test-Path $bundle)) {
  throw "Bundle missing after build: $bundle"
}

Write-Host "Installing into $target"
if (Test-Path $target) {
  Remove-Item $target -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $target | Out-Null

# Package files Poi needs
Copy-Item (Join-Path $pkg 'package.json') $target -Force
Copy-Item (Join-Path $pkg 'poi') (Join-Path $target 'poi') -Recurse -Force
New-Item -ItemType Directory -Force -Path (Join-Path $target 'dist') | Out-Null
Copy-Item $bundle (Join-Path $target 'dist\poi-bundle.cjs') -Force

# Register in plugins/package.json if present
$pluginsPkg = Join-Path $poiPlugins 'package.json'
if (Test-Path $pluginsPkg) {
  $json = Get-Content $pluginsPkg -Raw | ConvertFrom-Json
  if (-not $json.dependencies) {
    $json | Add-Member -NotePropertyName dependencies -NotePropertyValue (New-Object PSObject)
  }
  $json.dependencies | Add-Member -NotePropertyName 'poi-plugin-kancolle-mcp' -NotePropertyValue 'file:node_modules/poi-plugin-kancolle-mcp' -Force
  $json | ConvertTo-Json -Depth 10 | Set-Content $pluginsPkg -Encoding UTF8
  Write-Host "Registered in $pluginsPkg"
}

# Token for OpenCode
$tokenFile = Join-Path $target 'poi\token.json'
if (-not (Test-Path $tokenFile)) {
  $token = -join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
  $dir = Split-Path $tokenFile
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  @{
    token = $token
    created_at = (Get-Date).ToUniversalTime().ToString('o')
  } | ConvertTo-Json | Set-Content $tokenFile -Encoding UTF8
}
$token = (Get-Content $tokenFile -Raw | ConvertFrom-Json).token

# Also write next to repo package for OpenCode convenience
Copy-Item $tokenFile (Join-Path $pkg 'token.json') -Force

# Env for current user
[Environment]::SetEnvironmentVariable('KANCOLLE_POI_MCP_TOKEN', $token, 'User')
$env:KANCOLLE_POI_MCP_TOKEN = $token

Write-Host ""
Write-Host "Installed poi-plugin-kancolle-mcp"
Write-Host "  MCP URL : http://127.0.0.1:39271/mcp"
Write-Host "  Token   : $tokenFile"
Write-Host "  Env     : KANCOLLE_POI_MCP_TOKEN set for current user"
Write-Host ""
Write-Host "Next: restart Poi -> Plugins -> enable 'KanColle MCP' -> login to game once"
Write-Host "Then restart OpenCode in the KanColle-Agent repo."

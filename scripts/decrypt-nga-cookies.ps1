# Decrypt Chrome v10 cookies for host filter and print Cookie header
param(
  [string]$DbPath = "$env:TEMP\nga-cookies.db",
  [string]$LocalStatePath = "$env:LOCALAPPDATA\Google\Chrome\User Data\Local State",
  [string]$HostLike = "%nga%"
)

Add-Type -AssemblyName System.Security

$local = Get-Content $LocalStatePath -Raw -Encoding UTF8 | ConvertFrom-Json
$encryptedKeyB64 = $local.os_crypt.encrypted_key
$encryptedKey = [Convert]::FromBase64String($encryptedKeyB64)
if ([Text.Encoding]::ASCII.GetString($encryptedKey, 0, 5) -ne 'DPAPI') {
  throw 'unexpected key prefix'
}
$masterKey = [System.Security.Cryptography.ProtectedData]::Unprotect(
  ($encryptedKey[5..($encryptedKey.Length-1)]),
  $null,
  [System.Security.Cryptography.DataProtectionScope]::CurrentUser
)

function Decrypt-CookieValue([byte[]]$enc) {
  if ($enc.Length -lt 31) { return $null }
  $prefix = [Text.Encoding]::ASCII.GetString($enc, 0, 3)
  if ($prefix -ne 'v10' -and $prefix -ne 'v11') { return $null }
  $nonce = $enc[3..14]
  $cipher = $enc[15..($enc.Length - 17)]
  $tag = $enc[($enc.Length - 16)..($enc.Length - 1)]
  $aes = [System.Security.Cryptography.AesGcm]::new($masterKey, 16)
  $plain = [byte[]]::new($cipher.Length)
  $tagArr = [byte[]]$tag
  $nonceArr = [byte[]]$nonce
  $cipherArr = [byte[]]$cipher
  $aes.Decrypt($nonceArr, $cipherArr, $tagArr, $plain)
  return [Text.Encoding]::UTF8.GetString($plain)
}

# Use sqlite via node is already done; query via System.Data not available.
# Read from a JSON dump produced by sibling script instead.
$dump = Join-Path $PSScriptRoot 'nga-cookie-values.json'
if (Test-Path $dump) {
  $items = Get-Content $dump -Raw | ConvertFrom-Json
} else {
  throw "run dump first: $dump"
}

$pairs = @()
foreach ($it in $items) {
  $bytes = [Convert]::FromBase64String($it.b64)
  try {
    $val = Decrypt-CookieValue $bytes
    if ($val) { $pairs += "$($it.name)=$val"; Write-Host "OK $($it.name) len=$($val.Length)" }
  } catch {
    Write-Host "FAIL $($it.name): $($_.Exception.Message)"
  }
}
$cookie = $pairs -join '; '
$cookie | Set-Content (Join-Path $PSScriptRoot 'nga-cookie-header.txt') -Encoding UTF8
Write-Host "WROTE cookie header ($($pairs.Count) cookies)"

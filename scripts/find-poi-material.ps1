$asar = "C:\Program Files\Poi\resources\app.asar"
$bytes = [System.IO.File]::ReadAllBytes($asar)
$text = [System.Text.Encoding]::UTF8.GetString($bytes)

function CountAndSnip($needle, $max=5) {
  $count = ([regex]::Matches($text, [regex]::Escape($needle))).Count
  Write-Host "count '$needle' = $count"
  $idx = 0
  $n = 0
  while ($n -lt $max) {
    $idx = $text.IndexOf($needle, $idx)
    if ($idx -lt 0) { break }
    $start = [Math]::Max(0, $idx-50)
    $len = [Math]::Min(300, $text.Length-$start)
    $snippet = $text.Substring($start, $len) -replace '[\x00-\x1F]',' '
    Write-Host "  [$n] $snippet"
    Write-Host ""
    $idx += $needle.Length
    $n++
  }
}

CountAndSnip 'createAPIGetMemberUseitemResponseAction' 8
Write-Host "==== slices named use ===="
CountAndSnip "name: 'use" 8
CountAndSnip "name: 'item" 5

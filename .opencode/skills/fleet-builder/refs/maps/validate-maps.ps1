[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$mapDirectory = $PSScriptRoot
$requiredModules = @('overview', 'routing', 'enemy', 'air-los', 'fleets', 'quests', 'notes')
$moduleOrder = @('overview', 'routing', 'enemy', 'air-los', 'bonus', 'fleets', 'quests', 'notes')
$moduleLabels = @{
    overview = '地图信息'
    routing = '带路条件'
    enemy = '敌方配置'
    'air-los' = '制空 / 索敌'
    bonus = '海域倍卡'
    fleets = '推荐编成'
    quests = '任务配置'
    notes = '备注'
}

$errors = [System.Collections.Generic.List[string]]::new()
$files = Get-ChildItem -LiteralPath $mapDirectory -File -Filter '*.md' |
    Where-Object { $_.Name -match '^(?<map>\d-\d)\.md$' } |
    Sort-Object Name

foreach ($file in $files) {
    $mapId = $file.BaseName
    $text = [IO.File]::ReadAllText($file.FullName)
    $lines = $text -split '\r?\n'

    $mapPattern = '(?m)^map:\s*["'']?{0}["'']?\s*$' -f [regex]::Escape($mapId)
    if ($text -notmatch $mapPattern) {
        $errors.Add("$($file.Name): front matter 的 map 与文件名不一致或缺失")
    }

    $h1 = @($lines | Where-Object { $_ -match '^# ' })
    if ($h1.Count -ne 1 -or $h1[0] -notmatch "^# \[map:$([regex]::Escape($mapId))\] $([regex]::Escape($mapId)) \S") {
        $errors.Add("$($file.Name): H1 必须唯一且匹配 '# [map:$mapId] $mapId <地图名>'")
    }

    $h2Matches = @($lines | ForEach-Object {
        if ($_ -match '^## \[module:([a-z-]+)\] (.+)$') {
            [pscustomobject]@{ Key = $Matches[1]; Label = $Matches[2] }
        } elseif ($_ -match '^## ') {
            $errors.Add("$($file.Name): 非规范 H2：$_")
        }
    })
    $keys = @($h2Matches.Key)

    foreach ($key in $keys) {
        if ($key -notin $moduleOrder) {
            $errors.Add("$($file.Name): 未知 module key '$key'")
        } elseif ($moduleLabels[$key] -ne ($h2Matches | Where-Object Key -eq $key | Select-Object -First 1).Label) {
            $errors.Add("$($file.Name): module '$key' 的中文标题不匹配")
        }
    }
    foreach ($key in $requiredModules) {
        if ($keys -notcontains $key) {
            $errors.Add("$($file.Name): 缺少必需模块 '$key'")
        }
    }
    foreach ($group in ($keys | Group-Object | Where-Object Count -gt 1)) {
        $errors.Add("$($file.Name): module '$($group.Name)' 重复")
    }

    $positions = @($keys | ForEach-Object { [array]::IndexOf($moduleOrder, $_) })
    for ($index = 1; $index -lt $positions.Count; $index++) {
        if ($positions[$index] -le $positions[$index - 1]) {
            $errors.Add("$($file.Name): 模块顺序不符合 FORMAT.md")
            break
        }
    }

    for ($index = 0; $index -lt $lines.Count; $index++) {
        if ($lines[$index] -match '^## \[module:([a-z-]+)\]') {
            $next = $index + 1
            while ($next -lt $lines.Count -and $lines[$next] -notmatch '^## ') { $next++ }
            $body = if ($next -gt ($index + 1)) {
                ($lines[($index + 1)..($next - 1)] -join "`n").Trim()
            } else {
                ''
            }
            if ([string]::IsNullOrWhiteSpace($body)) {
                $errors.Add("$($file.Name): module '$($Matches[1])' 为空")
            }
        }
    }
}

if ($files.Count -ne 37) {
    $errors.Add("正式地图文件数量应为 37，实际为 $($files.Count)")
}

if ($errors.Count -gt 0) {
    $errors | ForEach-Object { Write-Error $_ }
    exit 1
}

Write-Output "OK: $($files.Count) 份地图文档通过标题与模块结构校验。"

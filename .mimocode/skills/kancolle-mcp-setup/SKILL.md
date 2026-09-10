---
name: kancolle-mcp-setup
description: 安装、配置、修复 KanColle Agent 的 Poi MCP 与 Data MCP。触发：安装 KanColle MCP、配置 poi-plugin-kancolle-mcp、Token 对不上、端口 39271、MCP 离线/500、把 KanColle Skill 装进 OpenCode 或 MiMo Desktop、KANCOLLE_POI_MCP_TOKEN、health 检查失败。覆盖 Poi 插件安装、mimocode.jsonc/opencode.jsonc、skill 复制与验证。
---

# KanColle MCP 安装与配置

目标仓库（默认）：

```text
C:\Users\12485\XiaomiMiMoProjects\KanColle-Agent
```

Poi 插件安装位置：

```text
%APPDATA%\poi\plugins\node_modules\poi-plugin-kancolle-mcp
```

MCP 端点默认：

```text
http://127.0.0.1:39271/mcp
GET  http://127.0.0.1:39271/health
```

**硬规则**：只读 MCP，禁止自动出击/远征/改修；Token 不写进 Git；`not_loaded` ≠ 数量 0；服务在线 ≠ 玩家已登录。

---

## 0. 总流程

```text
构建仓库 → 安装 Poi 插件 → 同步 Token
    → 配置宿主 MCP（MiMo Desktop / OpenCode）
    → 可选：安装 KanColle Skills
    → health + tools/call 验证
```

---

## 1. 前置检查

```powershell
# 仓库
Test-Path "C:\Users\12485\XiaomiMiMoProjects\KanColle-Agent\package.json"

# Poi
Test-Path "$env:APPDATA\poi\plugins"

# Node
node -v   # 需要 >= 20

# Poi 是否在跑
Get-Process poi -ErrorAction SilentlyContinue
```

缺仓库：先 clone `git@github.com:Yukikaze030/KanColle-Agent.git`。

---

## 2. 构建仓库

```powershell
cd C:\Users\12485\XiaomiMiMoProjects\KanColle-Agent
npm install
npm run build
```

确认存在：

```text
packages\poi-plugin-mcp\dist\poi-bundle.cjs
packages\kancolle-data-mcp\src\index.ts
.opencode\skills\kancolle-main\SKILL.md
```

---

## 3. 安装 / 更新 Poi 插件

优先用脚本：

```powershell
powershell -ExecutionPolicy Bypass -File `
  C:\Users\12485\XiaomiMiMoProjects\KanColle-Agent\scripts\install-poi-plugin.ps1
```

脚本会：复制 `package.json` / `poi/` / `dist/poi-bundle.cjs` → 写入 `plugins\package.json` → 生成/对齐 token → 设置用户环境变量 `KANCOLLE_POI_MCP_TOKEN`。

手动等价（脚本失败时）：

```powershell
$pkg = "C:\Users\12485\XiaomiMiMoProjects\KanColle-Agent\packages\poi-plugin-mcp"
$dst = "$env:APPDATA\poi\plugins\node_modules\poi-plugin-kancolle-mcp"
Remove-Item $dst -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path "$dst\dist","$dst\poi" | Out-Null
Copy-Item "$pkg\package.json" $dst -Force
Copy-Item "$pkg\poi\*" "$dst\poi\" -Recurse -Force
Copy-Item "$pkg\dist\poi-bundle.cjs" "$dst\dist\" -Force
```

然后 **完全退出 Poi（含托盘）再启动**，在扩展程序中启用 **KanColle MCP**。

---

## 4. Token（必须对齐）

插件启动时可能重新生成 token。以 **插件目录** 的文件为准：

```powershell
$tokenFile = "$env:APPDATA\poi\plugins\node_modules\poi-plugin-kancolle-mcp\poi\token.json"
$token = (Get-Content $tokenFile -Raw | ConvertFrom-Json).token

# 同步到用户环境变量
[Environment]::SetEnvironmentVariable('KANCOLLE_POI_MCP_TOKEN', $token, 'User')

# 同步到仓库（gitignore 已忽略）
Copy-Item $tokenFile "C:\Users\12485\XiaomiMiMoProjects\KanColle-Agent\packages\poi-plugin-mcp\token.json" -Force
```

**排查 401**：三处 token 必须一致——插件 `token.json`、用户环境变量、宿主 MCP headers。

---

## 5. 配置 MiMo Desktop MCP

编辑（只改顶层 `mcp` 段，保留其余内容）：

```text
C:\Users\12485\.config\mimocode\mimocode.jsonc
```

合并进去：

```jsonc
"mcp": {
  "kancolle-poi": {
    "type": "remote",
    "url": "http://127.0.0.1:39271/mcp",
    "enabled": true,
    "headers": {
      "Authorization": "Bearer ${KANCOLLE_POI_MCP_TOKEN}"
    }
  },
  "kancolle-data": {
    "type": "local",
    "command": [
      "npx",
      "tsx",
      "C:/Users/12485/XiaomiMiMoProjects/KanColle-Agent/packages/kancolle-data-mcp/src/index.ts"
    ],
    "enabled": true
  }
}
```

注意：

- 若引擎不展开 `${KANCOLLE_POI_MCP_TOKEN}`，把实际 token 字面量写进 headers（仍不要提交 Git）。
- **重启引擎或新开对话** 才会加载 MCP。

可选静态数据路径：

```text
KANCOLLE_DATA_PATH=C:\Users\12485\XiaomiMiMoProjects\KanColle-Agent\packages\kancolle-data-mcp\data\fixtures\kancolle.json
```

---

## 6. 配置 OpenCode

在仓库根目录，`opencode.jsonc` 已包含 `kancolle-data` + `kancolle-poi`。确保：

1. 用 OpenCode 打开 **KanColle-Agent 仓库根目录**
2. 进程能读到 `KANCOLLE_POI_MCP_TOKEN`
3. `.opencode/agents/` 与 `.opencode/skills/` 已存在

自检：

```powershell
cd C:\Users\12485\XiaomiMiMoProjects\KanColle-Agent
npm run setup
```

---

## 7. 安装 KanColle Skills（Agent 用）

### OpenCode（本仓库）

Skills 已在 `.opencode/skills/`，打开仓库即自动发现，无需另装。

### MiMo Desktop

复制到项目或全局（新开对话生效）：

```powershell
$src = "C:\Users\12485\XiaomiMiMoProjects\KanColle-Agent\.opencode\skills"
$dstProj = "C:\Users\12485\XiaomiMiMoProjects\KanColle-Agent\.mimocode\skills"
$dstGlob = Join-Path $env:USERPROFILE ".config\mimocode\skills"

$skills = @(
  'kancolle-main','quest-planner','fleet-builder',
  'equipment-planner','progression-planner','event-guide','combat-knowledge'
)

foreach ($root in @($dstProj, $dstGlob)) {
  foreach ($s in $skills) {
    $to = Join-Path $root $s
    New-Item -ItemType Directory -Force -Path $to | Out-Null
    Copy-Item (Join-Path $src "$s\SKILL.md") (Join-Path $to "SKILL.md") -Force
  }
}
```

OpenCode 的 `.opencode` skill 也可被引擎作兼容读取；优先写入 `.mimocode/skills`。

---

## 8. 验证（必做）

```powershell
# 1) 健康
Invoke-RestMethod http://127.0.0.1:39271/health

# 期望: ok=true, online=true, player_logged_in=true(已登录), ships/equipment > 0

# 2) Token
$token = [Environment]::GetEnvironmentVariable('KANCOLLE_POI_MCP_TOKEN','User')

# 3) MCP initialize
Invoke-WebRequest -Uri http://127.0.0.1:39271/mcp -Method POST `
  -Headers @{ Authorization="Bearer $token"; "Content-Type"="application/json"; Accept="application/json, text/event-stream" } `
  -Body '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"check","version":"1"}}}' `
  -UseBasicParsing

# 4) 业务调用
# tools/call name=poi_get_overview 或 poi_status
```

**判定**

| health | MCP | 含义 |
|--------|-----|------|
| 连接拒绝 | — | Poi 未开 / 插件未启用 / 未重启 |
| 401 | 401 | Token 不一致 |
| 200 online=true | 200 | 正常 |
| 200 但 player_logged_in=false | 200 | 服务正常，需进一次母港 |

---

## 9. 常见故障

| 现象 | 处理 |
|------|------|
| 插件列表有、宫格无 | 需要 `reactClass` 面板；已含则重启 Poi |
| 面板离线 HTTP 500 | 旧传输层问题；更新 `poi-bundle.cjs` 后重启 Poi |
| 401 unauthorized | 对齐 token（§4） |
| 舰娘 0 / 未登录 | 进母港；`game.response` 后会同步 |
| 端口占用 | 改 `POI_MCP_PORT`，并同步宿主 `url` |
| MiMo 看不到 skill | 写到 `.mimocode/skills` 或 `~/.config/mimocode/skills`，**新开对话** |
| MiMo 看不到 MCP | 改 `mimocode.jsonc` 的 `mcp` 段后重启引擎/新开对话 |

### 重装插件

```powershell
powershell -ExecutionPolicy Bypass -File `
  C:\Users\12485\XiaomiMiMoProjects\KanColle-Agent\scripts\install-poi-plugin.ps1
# 然后完全重启 Poi
```

### 换端口

```powershell
$env:POI_MCP_PORT = "39272"
# 同时改 mimocode.jsonc / opencode.jsonc 中的 url
```

---

## 10. 安全边界

- 仅绑定 `127.0.0.1`
- Bearer Token 仅用于 MCP，禁止复用游戏 Cookie/DMM Session
- 不打印 Cookie / 完整认证请求
- Token 文件勿提交 Git（仓库 `.gitignore` 已含 `packages/poi-plugin-mcp/token.json`）

---

## 交付检查清单

- [ ] `npm run build` 成功  
- [ ] Poi 插件已安装并重启启用  
- [ ] 面板「服务状态=在线」且已登录时舰娘数 > 0  
- [ ] `KANCOLLE_POI_MCP_TOKEN` 与插件 token.json 一致  
- [ ] 宿主（MiMo / OpenCode）已配置两个 MCP  
- [ ] `/health` 与 `initialize` / `poi_get_overview` 返回 200  
- [ ]（可选）KanColle skills 已装入对应 skills 目录  

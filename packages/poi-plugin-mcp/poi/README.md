# KanColle MCP for Poi

Poi 插件：把玩家 Snapshot 暴露为 localhost MCP（只读）。

## 安装

在 KanColle-Agent 仓库根目录执行：

```powershell
npm install
npm run build
.\scripts\install-poi-plugin.ps1
```

或手动：

```powershell
cd "$env:APPDATA\poi\plugins"
npm install "file:C:\path\to\KanColle-Agent\packages\poi-plugin-mcp"
```

然后重启 Poi，启用插件 `KanColle MCP`。

## 端点

- URL: `http://127.0.0.1:39271/mcp`
- Token: 安装后生成 `token.json`（插件目录或仓库 `packages/poi-plugin-mcp/token.json`）
- 环境变量: `KANCOLLE_POI_MCP_TOKEN=<token>`

## 行为

- 监听 `game.response`，每次 KCSAPI 后从 Poi Redux 同步 Snapshot
- 每 15s 兜底全量同步
- 只读，不执行出击/远征/改修

## 卸载

```powershell
cd "$env:APPDATA\poi\plugins"
npm uninstall poi-plugin-kancolle-mcp
```

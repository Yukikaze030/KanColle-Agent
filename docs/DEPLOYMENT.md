# 部署

## 用户机器

```
Windows
├── Poi + poi-plugin-kancolle-mcp → http://127.0.0.1:39271/mcp
├── Node.js ≥ 20
├── OpenCode
│   ├── Data MCP (stdio)
│   ├── Poi MCP (HTTP + Token)
│   └── .opencode agents/skills
└── Browser / KanColle
```

## 安装步骤

```bash
git clone git@github.com:Yukikaze030/KanColle-Agent.git
cd KanColle-Agent
npm install
npm run build
npm test
npm run verify
npm run setup
```

### Poi 插件

1. 将 `packages/poi-plugin-mcp` 安装为 Poi 插件（或开发时 `npm run start -w poi-plugin-kancolle-mcp` 用 mock）
2. 读取生成的 `packages/poi-plugin-mcp/token.json`
3. 设置环境变量 `KANCOLLE_POI_MCP_TOKEN`

### OpenCode

仓库根目录的 `opencode.jsonc` 注册：

- `kancolle-data`：`npx tsx packages/kancolle-data-mcp/src/index.ts`
- `kancolle-poi`：`http://127.0.0.1:39271/mcp` + Bearer Token

## 配置

`config/kancolle.json`：locale、wiki 优先级、poi URL、token 预算。

Token 不提交 Git。可用 `config/kancolle.local.json` 覆盖（已 gitignore）。

## 更新

```bash
git pull
npm install
npm run build
# 重启 OpenCode / Data MCP；Poi 插件随 Poi 生命周期
```

Data 数据集更新：升级数据依赖或替换 `KANCOLLE_DATA_PATH` 后重启 Data MCP。V1 不做后台自动下载，保证可复现。

## 日志

- Poi Plugin：INFO/WARN/ERROR/DEBUG，禁止 Cookie/Token
- Data MCP：dataset version / startup / query error，不接触玩家数据

# Poi MCP

玩家实时状态数据服务。只读。绑定 `127.0.0.1`，独立 Access Token。

## 职责

回答：**玩家现在有什么？**

- 舰娘 / 装备 / 等级 / 资源 / 任务 / 舰队 / 远征 / 入渠 / 出击

## 架构

```
Poi Redux / KCSAPI Events
       │
       ▼
  ReduxAdapter / ApiEventAdapter
       │
       ▼
     Normalizer
       │
       ▼
  PlayerSnapshot (version++)
       │
       ▼
  Player Services → MCP Tools (8)
```

## Tools

| Tool | 说明 |
|------|------|
| `poi_status` | 在线、登录、域 freshness |
| `poi_get_overview` | 资源/桶/容量/远征入渠数/是否出击 |
| `poi_query_ships` | 过滤舰娘；instances/aggregate；fields/cursor |
| `poi_query_equipment` | 默认 aggregate |
| `poi_get_fleets` | 1–4 队与联合 |
| `poi_get_quests` | 当前+观察历史；缺=unknown |
| `poi_get_inventory` | 材料/道具 + coverage |
| `poi_get_operations` | 远征/入渠/建造/出击/上一战 |

## Token

首次启动生成 `packages/poi-plugin-mcp/token.json`（勿提交）。环境变量：

```
KANCOLLE_POI_MCP_TOKEN=<token>
POI_MCP_PORT=39271
```

## 开发模式（无 Poi）

```bash
npm run start -w poi-plugin-kancolle-mcp
```

加载 `fixtures/mock-player-A.json`。

## 安全

- 只读，禁止自动出击/装备/远征/改修
- 不打印 Cookie / API Token / 完整认证请求
- Token 仅用于 MCP，禁止复用游戏会话

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
  Player Services → MCP Tools (9)
```

## Tools

| Tool | 说明 |
|------|------|
| `poi_status` | 在线、登录、域 freshness |
| `poi_get_overview` | 资源/桶/容量/远征入渠数/是否出击 |
| `poi_query_ships` | 过滤舰娘；instances/aggregate；fields/cursor |
| `poi_query_equipment` | 默认 aggregate |
| `poi_query_fleet_assets` | 按舰种/装备类型或 master ID 批量返回配队资产；装备默认聚合 |
| `poi_get_fleets` | 默认一次读取 1–4 队成员、普通槽/增设槽装备实例、搭载数、联合及远征；可筛队或省略装备明细 |
| `poi_get_quests` | 当前+观察历史；缺=unknown |
| `poi_get_inventory` | 材料/道具 + coverage |
| `poi_get_operations` | 远征/入渠/建造/出击/上一战 |

## 当前舰队读取

Poi Redux 的舰队来源为 `info.fleets`（兼容别名 `info.deck`），舰船的 `fleet_id` 按 `api_ship` 成员表反查，不依赖不存在的 `api_fleet`。装备归属同时扫描 `api_slot` 与 `api_slot_ex`。舰队成员保持顺序，支持七舰编成；`api_mission[0]` 为状态，任务 ID 取 `[1]`；联合标志取 `sortie.combinedFlag`。

`poi_get_fleets({})` 在同一快照内连接舰队、舰船、装备，返回装备改修/熟练度与当前/最大搭载数。`api_onslot_max` 优先于舰船主表容量，以保留玩家的机库扩张。缺来源时返回 `not_ready` / `partial` 与 `missing`，不伪造空槽。

更新插件后重新加载 KanColle MCP（禁用再启用，或重启 Poi），回母港后调用 `poi_get_fleets` 验证四队及增设槽；只验证 `poi_status` 在线不足以证明舰队读取正常。安装更新须保留现有 `poi/token.json`，避免已配置客户端认证失效。

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

# Data MCP

本地静态游戏数据服务。stdio。不依赖 Poi，无网络监听。

## 职责

回答：**游戏数据库里是什么？**

## 架构

```
MCP Tools
   │
   ▼
Normalized Service
   │
   ├── Entity Index
   ├── Quest Graph
   └── Rule Engine
         │
         ▼
   Data Adapter → fixtures / kancolle-data
```

## Tools（7）

| Tool | 说明 |
|------|------|
| `kc_search` | 名称/别名/WikiID/GameID → 小列表 |
| `kc_get` | 单实体；include 可选 remodel/graph |
| `kc_query` | 结构化筛选 + fields/limit/cursor |
| `kc_quest_graph` | 前置/后续节点边 |
| `kc_ship_remodel` | 改造链与等级 |
| `kc_equipment_rules` | 舰种能否装备 / 谁能装备 |
| `kc_data_status` | 数据集版本与能力 |

## 数据源

V1 使用 `packages/kancolle-data-mcp/data/fixtures/kancolle.json`（可测试、可复现）。

可通过环境变量替换：

```
KANCOLLE_DATA_PATH=/path/to/dataset.json
```

后续可接入 `kcwiki/kancolle-data` npm 数据。

## Result 语义

- `ok` / `not_found` / `partial` / `ambiguous` / `error`
- `not_found` 是正常结果 → Main Agent 转 Wiki
- `partial` 带 `missing: [...]`
- `ambiguous` 返回 candidates，不自动猜

## 内存索引

启动时构建 shipsById/Name、equipmentById/Name、questsByGameId/WikiId/Name、expeditions、maps、任务前后置边。V1 不使用数据库。

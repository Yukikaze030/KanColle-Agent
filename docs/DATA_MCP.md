# Data MCP

本地静态游戏数据服务。stdio。不依赖 Poi，无网络监听。

**游戏时期：只服务二期**（2023-05 服务器迁移后）。`kc_data_status` 返回 `era: "2"`。

## 职责

回答：**游戏数据库里是什么？（二期）**

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

### 正式库（默认）

```text
packages/kancolle-data-mcp/data/official/dataset.json
```

由 `npm run fetch:data` 生成：

| 实体 | 来源 |
|------|------|
| 舰娘 / 装备 | kcwiki/kancolle-data `db/ship.json` `db/equipment.json` |
| 任务 | `kcwiki-quest-data` npm |
| stype / 可装备规则 / 远征 / 海域 | 本地 fixtures overlay（按**名称**合并） |

规模：**舰娘 610 · 装备 583 · 任务 446**。

```bash
npm run fetch:data   # 刷新正式库
```

### 回退 fixtures

```bash
KANCOLLE_DATA_SOURCE=fixture
# 或指定文件
KANCOLLE_DATA_PATH=/path/to/dataset.json
```

### 已知限制

- 官方 `db/ship.json` 不含完整 stype；仅名称命中 fixture 的舰体会带 stype。
- `remodel_from/to` 部分来自日文名启发式；改造等级仅对 overlay 命中项可靠。
- 以 `game_id` 为准；wiki 编号可能与社区别名不完全一致。

## Result 语义

- `ok` / `not_found` / `partial` / `ambiguous` / `error`
- `not_found` 是正常结果 → Main Agent 转 Wiki
- `partial` 带 `missing: [...]`
- `ambiguous` 返回 candidates，不自动猜

## 内存索引

启动时构建 shipsById/Name、equipmentById/Name、questsByGameId/WikiId/Name、expeditions、maps、任务前后置边。V1 不使用数据库。

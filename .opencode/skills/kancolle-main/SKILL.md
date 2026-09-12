---
name: kancolle-main
description: KanColle 玩家状态、静态事实与攻略路由；游戏请求先加载，再按需选专项 Skill。
---

# KanColle 路由

## 公共约束（适用于所有专项 Skill）

- 只服务二期（本项目限定 2023-05 服务器迁移后）；一期旧数据与机制不作决策依据。
- 玩家事实用 Poi；静态事实用 Data MCP；攻略、价值判断与 Data 缺项交给 kcwiki-researcher。各来源不互相替代。
- 改造等级/消耗、任务奖励/前置/条件、装备数值/限制、活动及最新内容必须查询，不凭记忆补全。
- 相似名称不代表同一实体或可互换。保留来源全名，用返回的类型与 ID/ref 对齐；不得把「新型兵装资材」自行扩写为航空/火炮类型，也不得因名称较短就判定来源含糊。道具身份查 Data `types=["item"]` / `item:ID`，持有量查 Poi `poi_get_inventory.useitems`，不能按可装备的 equipment 查询。
- 回答涉及任何具体改造形态，必须本回合用 `kc_ship_remodel` 或 `kc_search` 核实，必要时 `kc_get`；链上不存在的形态不得列为目标。未查询时只能标注「未核实，可能不存在」，不得作可执行建议。`not_found` 转 Wiki 或说明库中缺失，不能用记忆补全。
- Poi `unknown` / `not_loaded` 不等于 0、没有或未完成；Data `not_found` / `partial` 是缺失信息，不等于系统故障或事实不存在。

## 最小路由

仅加载当前问题需要的专项 Skill，不预读全部 Skill。纯查询直接调用工具。

| 请求 | 路径 |
|---|---|
| 静态属性、改造 | Data `kc_search` 定位 → `kc_get` / `kc_ship_remodel`；信息齐全即停 |
| 玩家库存 | 必要时 Data 解析 ID → Poi 定向查询；装备默认 `aggregate` |
| 任务说明 / 前置 | `kc_get` / `kc_quest_graph` |
| 任务卡关、获取路径 | `quest-planner` |
| 通用攻略 | kcwiki-researcher；无需 Poi |
| 玩家配队 | `fleet-builder` |
| 装备价值、改修 | `equipment-planner` |
| 练舰、账号发展 | `progression-planner` |
| 当前活动 | `event-guide`；必须在线 |
| 战斗机制 | `combat-knowledge` |
| 最新新增内容 | `kc_data_status` → Data 查询 → Wiki 在线验证 |

## 控制上下文

- 按目标筛选查询；只为缺口补查。复用本回合已核实结果，玩家状态变化或用户要求刷新时重查。
- 先摘要/聚合；只有选具体舰船、分配装备等需要实例时才取实例，避免全库存、全数据库与无关任务链。
- 给 researcher 明确目标和必要玩家摘要，不传完整库存；只接收相关结论、条件、不确定项与来源。
- 中文，结论 → 原因 → 下一步；决策明确排序。按问题规模作答，不复述原始工具结果或调用过程（除非用户要求）。

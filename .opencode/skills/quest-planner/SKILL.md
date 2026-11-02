---
name: quest-planner
description: 任务卡关、前置链与奖励获取路径规划；简单任务说明直接查 Data。
---

# 任务规划

遵循已加载的 `kancolle-main` 公共约束；若未加载，先加载。

1. 先读 `refs/INDEX.md`，按问题读取任务状态说明、周期任务海域或来源页；本地已有答案时不重复联网。
2. `kc_search` 按 wiki_id / 名称 / game_id 定位；多个高分候选用 `kc_get` 确认或澄清。
3. 需要玩家进度时先查 `poi_get_quests(mode="compact")`，再把分组 ID 传给 `kc_quest_progress`，一次取得目标的完整前置链和状态；只有需要名称、进度提示或时间戳时才对少数 `game_ids` 查询 `mode="records"`。
4. 状态语义：`available` 已开放未接取，`active` 已接取，`claimable` 已达成待领奖，`observed_completed` 本插件观察到曾领奖，`inferred_completed` 根据当前已开放任务的祖先关系推断，`unknown` 无证据。缺席绝不等于未完成或锁定。
5. `progress_flag` 只表示无提示、50%+、80%+ 三档，不可当作精确完成比例。Poi 插件安装前的真实历史不可恢复；图谱推断也不得表述为游戏 API 明示记录。
6. 对 `kc_quest_progress.unresolved_ids` 从最靠前的前置开始排查；`claimable` 优先提醒领奖，`available` 可建议接取。Data 缺条件/奖励时，先查本地 refs，再委派 researcher 只查目标任务。

## 出击任务如何完成（硬流程）

1. **Data MCP 先行**：`kc_search` / `kc_get` 得到任务 **game_id、名称、wiki_id**。
2. **查中央推荐表**：`fleet-builder/refs/quest-sortie-configs.md`（按 wiki_id / 日文名 / 键如 Bm1、Bq2）。
3. **命中** → 推荐海域/编成；细节读 `data/kancolle-maps/index.json` → `meta/<图>.json` 或 `refs/maps/<图>.md`。
4. **未命中** → maps 任务表；仍无则 researcher（只查该任务）。
5. 编成含改造形态 → 必须 `kc_ship_remodel` 核实，禁止编造改二。

输出：任务状态 → 推荐海域/编成（附来源键）→ 条件摘要 → 下一步。每次出现任务都必须写成 `Wiki编号 — 完整任务名称（game_id）`，例如 `B51 — 新編「第二一戦隊」北方へ出撃せよ！（game_id: 288）`；禁止只列 B51、F65 等编号。

数据源：`data/kancolle-maps/`（HTML/meta 映射）+ `fleet-builder/refs/quest-sortie-configs.md` + 本 Skill `refs/`。

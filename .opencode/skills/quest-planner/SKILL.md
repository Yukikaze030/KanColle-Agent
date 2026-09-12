---
name: quest-planner
description: 任务卡关、前置链与奖励获取路径规划；简单任务说明直接查 Data。
---

# 任务规划

遵循已加载的 `kancolle-main` 公共约束；若未加载，先加载。

1. `kc_search` 按 wiki_id / 名称 / game_id 定位；多个高分候选用 `kc_get` 确认或澄清。
2. `kc_quest_graph` 仅查所需方向与深度（≤5），不假定截断结果是完整链。
3. 需要玩家进度时查 `poi_get_quests`：`observed_completed` 已完成、`active` 进行中、`unknown` 无证据；插件安装前的历史不可伪造。
4. 找前置已完成的候选；`available` 可建议执行，`unknown` 先核对是否出现，不能断言未完成。`active` 结合 progress 与条件判断。
5. Data 缺条件/奖励时，委派 researcher 只查目标任务，不读任务总页。

## 出击任务如何完成（硬流程）

1. **Data MCP 先行**：`kc_search` / `kc_get` 得到任务 **game_id、名称、wiki_id**。
2. **查中央推荐表**：`fleet-builder/refs/quest-sortie-configs.md`（按 wiki_id / 日文名 / 键如 Bm1、Bq2）。
3. **命中** → 直接给出推荐海域、编成、胜利条件、制空/索敌；可再读 `fleet-builder/refs/maps/<图>.md` 细节。
4. **未命中** → 读该图 maps 文件的任务表；仍无则 researcher（只查该任务）。
5. 编成含改造形态 → 必须 `kc_ship_remodel` 核实，禁止编造改二。

输出：任务状态 → 推荐海域/编成（附来源键）→ 条件摘要 → 下一步。

附属查阅：`refs/SOURCES.md` 与 `refs/*.md`（二期任务精简页；缺条件时先 refs 再 researcher）。

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

输出目标与状态、相关前置路径、优先下一步及依据；仅补充所需条件、奖励和不确定项。

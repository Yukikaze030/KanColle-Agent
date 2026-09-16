---
era: "2"
source: "https://github.com/lawvs/poi-plugin-quest-2/"
updated: "2026-09-16"
summary: "Poi 任务状态、历史完成与前置链推断的真实语义。"
---

# 任务状态模型

## 游戏当前列表

KCSAPI `api_get_member/questlist` 中：`api_state=1` 是已开放未接取，`2` 是已接取，`3` 是已完成待领奖。`api_progress_flag` 只有 0/1/2，对应无提示、50% 以上、80% 以上，不是精确百分比。

Poi 核心的 `info.quests.activeQuests` 只适合补充已接取任务；Quest Information 2 插件的 `ext.*._.questList` 保存最近取得的任务列表。MCP 同时读取两者并按 game_id 合并。

## 已完成任务

游戏 API 不提供完整历史。MCP 只把实际观察到 `api_quest/clearitemget` 领奖的任务记为 `observed_completed`，并在后续任务页同步时保留。若重复任务再次出现，当前 `available/active/claimable` 优先，同时保留 `last_completed_at`。

Quest Information 2 的做法是：从当前出现的任务沿静态前置图向上遍历，把祖先标记为已完成，并用向下遍历估计锁定任务。这是合理推断，不是服务器历史。MCP 的 `kc_quest_progress` 复用祖先推断，但对无法证明的缺席任务保留 `unknown`，避免误判。

## 推荐调用

1. `poi_get_quests(mode="compact")` 获取各状态 ID，减少输出。
2. `kc_quest_progress(quest=目标, player_states=上述分组)` 注释完整前置链。
3. 只对链上少数当前任务调用 `poi_get_quests(game_ids=[...], mode="records")` 查看名称、50%/80% 提示和时间。

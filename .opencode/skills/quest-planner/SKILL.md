---
name: quest-planner
description: 任务链、前置、卡关、奖励获取路径。处理「我距离 B128 还有多远」「为什么做不了这个任务」等问题。
---

# Quest Planner Skill

**时期：只认二期任务数据。** 一期任务条件/奖励若与二期冲突，以二期为准。涉及舰娘改造形态条件时须 Data 核实，禁止编造改二。

## 触发

任务链 / 前置 / 规划 / 卡住 / 奖励路径 / 「距离 X 还有多远」。

## 工作流

1. **定位目标任务**
   - Data `kc_search`（支持 wiki_id 如 B128、名称、game_id）
   - 多个高分候选 → `kc_get` 确认或向用户澄清

2. **任务图**
   - Data `kc_quest_graph`（direction=up/down/both, depth≤5）
   - 得到完整前置链与后续

3. **玩家状态**
   - Poi `poi_get_quests`
   - 对图中每个任务标注：
     - `observed_completed` → 已完成
     - `active` → 进行中
     - `unknown` → **无证据，不能当作未完成**

4. **缺口分析**
   - 找出第一层「前置完成但自身 unknown/available」的任务作为下一步
   - 若 `active`，看 progress 与条件

5. **条件补全**
   - 若 Data 任务缺 `requirements`/`missing`
   - 启动 kcwiki-researcher，**只查目标任务**，不要读任务总页

## 输出模板

```
目标任务：<name> (<ref>)
当前状态：active / observed_completed / unknown
前置路径：A → B → C → 目标
下一步建议：优先做 X（原因）
完成条件：…
奖励：…
注意事项：…（Wiki）
```

不要输出整个任务数据库。

## 硬规则

- Poi 无记录 = unknown，禁止说「你没做这个任务」
- 安装插件之前的历史不可伪造
- 奖励/条件优先 Data，缺失再 Wiki

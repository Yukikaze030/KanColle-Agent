---
name: combat-knowledge
description: 解释战斗机制，查询精确公式、触发条件及活动特例，并诊断玩家编成。
---

# 战斗机制

遵循已加载的 `kancolle-main` 公共约束；若未加载，先加载。

- 装备数值/适配先查 Data `kc_get` / `kc_equipment_rules`。
- 精确公式、触发条件、机制诊断与活动特例委派 researcher 查对应术语页；不在 Skill 中维护机制速查表。
- 诊断玩家「为何未触发 / 如何调整」时，按需查 Poi 当前编成与装备。
- 只解释与问题相关的条件、证据及调整建议，不倾倒整页公式；数值须有 Data / Wiki 依据。

附属查阅：`refs/SOURCES.md` 与 `refs/*.md`（二期公式/术语精简；勿把整表塞回本 SKILL）。

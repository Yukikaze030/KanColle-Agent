---
name: fleet-builder
description: 用玩家现有舰娘与装备配队，校验路线、装备适配并给替代方案。
---

# 配队

遵循已加载的 `kancolle-main` 公共约束；若未加载，先加载。

1. researcher 查询目标图的路线、带路、制空、索敌与 Boss；已有适用资料则复用。
2. `poi_query_ships` 按舰种/等级/损伤筛选，`mode=instances`；必要时 Data 补舰种与数值。
3. `poi_query_equipment` 先 `aggregate`，分配具体装备时再取所需实例；`kc_equipment_rules` 校验适配。
4. 给出编成、等级、配装、路线条件与风险；联合舰队区分一/二队。

不把大破/入渠舰列入主力；未持有装备标明「需获取」。缺关键装备给可用替代及影响，不能把同一库存实例重复分配。

附属查阅：`refs/SOURCES.md` 与 `refs/*.md`（路线/制空/索敌精简页）。常规图带路优先 `refs/maps-routing.md`（NGA tid=23451223 落盘版）。

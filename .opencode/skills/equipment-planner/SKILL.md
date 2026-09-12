---
name: equipment-planner
description: 结合库存判断装备价值、改修优先级、重复装备处理与缺口。
---

# 装备规划

遵循已加载的 `kancolle-main` 公共约束；若未加载，先加载。

1. `poi_query_equipment` 默认 `mode=aggregate`，检查同类数量与 improvement 分布；涉及成本时 `poi_get_inventory` 查资材。
2. `kc_get` 查属性，需同类比较才用 `kc_query`；陆基/舰载规则用 `kc_equipment_rules` 区分。
3. 价值判断缺依据时交 researcher；精确改修消耗缺结构化数据时查 Wiki，仍缺则说明未知，不伪造成本。
4. 按玩家缺口排序，给目标改修档位、理由、已有数量、成本依据与替代品；必要时说明暂缓项。

不为价值判断展开全量装备实例。

---
name: equipment-planner
description: 结合库存判断装备价值、改修优先级、重复装备处理与缺口。
---

# 装备规划

遵循已加载的 `kancolle-main` 公共约束；若未加载，先加载。

1. `poi_query_equipment(mode="aggregate")` 检查持有数量与 improvement 分布；`poi_get_inventory` 查资材，`poi_query_ships` 取得玩家持有的精确舰娘 master ID。
2. **每日改修只能查 `kc_improvement`**：把持有装备 ID 传 `equipment_ids`、持有舰娘 ID 传 `owned_ship_ids`，默认按东京当天过滤。星期、支援舰、各阶段消耗与更新目标不得改查 Wiki，也不得凭记忆补全；数据缺失或过期时明确提示运行 `npm run fetch:improvements`。
3. 改修支援舰按 master ID 与具体改造形态强绑定。`金剛`、`金剛改`、`金剛改二`、`金剛改二丙` 是不同舰娘；禁止按舰娘家族、名称前缀或基础名合并。输出具体形态前仍须遵守主 Skill 的 Data 核实规则。
4. `kc_get` 查装备属性，需同类比较才用 `kc_query`；陆基/舰载规则用 `kc_equipment_rules` 区分。价值判断缺依据时可用本地 refs 或 researcher，但不得让攻略来源覆盖 `kc_improvement` 的日程与成本。
5. 按玩家缺口排序，给目标改修档位、理由、已有数量、当天可用的精确支援舰、成本与替代品；必要时说明暂缓项。

不为价值判断展开全量装备实例。

附属查阅：`refs/SOURCES.md` 与 `refs/*.md`（改修优先级/价值精简页）。

---
name: progression-planner
description: 结合舰娘等级、改造链、资源与功能缺口安排练舰和账号发展优先级。
---

# 练舰规划

遵循已加载的 `kancolle-main` 公共约束；若未加载，先加载。

1. `poi_query_ships` 查看相关舰娘与等级；结合已有高等级舰找功能缺口，避免重复建设。
2. 对每艘拟推荐改造的船用当前形态 ID 调用 `kc_ship_remodel`，核实目标形态及等级；需要跨多次改造规划才取 `scope=family`。优先考虑接近下一改且有价值的候选；无下一改则只设当前形态练级或已核实活动需求。
3. 改造建议必须核对目标的完整消耗，再用 `poi_get_inventory` 对照持有量及 coverage。以 `transitions` 的有向转换及消耗为准；`partial/missing` 不等于免费。Data 缺消耗或道具定义才委派 researcher 定向补查。
4. 资材用 `kc_search(types=["item"])` / `kc_get(item:ID)` 按需核实身份，再按 ID 对照 `useitems.master_id/name/count`；equipment 消耗查装备库存，resources 对照基础资源，不能混用或拿相似道具数量代替。翻译/别名关系无证据时保留原名并待核实，不猜航空/火炮二选一。
5. 当前版本价值/活动需求交 researcher。按排序累计扣除共用资源，区分「现在可改」「先练级、待资源」「待核实」。已知一项不足可判暂不能改，但消耗未全时不得声称唯一瓶颈或排序不受影响。
6. 输出优先级、当前 → 目标等级、理由及相关资源的需求/持有/缺口；大破/入渠舰不作近期练级首选。影响可行性的缺项在本次任务内补查；仍不可得则列明，不能以“可另查”代替核实。

附属查阅：`refs/SOURCES.md` 与 `refs/*.md`（练舰价值笔记）。改造是否存在与消耗仍以 Data `kc_ship_remodel` 为准，refs 不得写未核实改二。

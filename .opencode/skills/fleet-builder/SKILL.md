---
name: fleet-builder
description: 配队、舰娘选择、装备选择与替代方案。处理「用我的舰娘配 5-5」「活动 E3 配队」等。
---

# Fleet Builder Skill

## 触发

配队 / 编成 / 用现有舰娘打某图或活动。

## 工作流

1. **攻略需求**
   - kcwiki-researcher 查询目标海域/活动：路线、条件、制空、索敌、Boss
2. **玩家舰娘**
   - Poi `poi_query_ships`（按 stype/等级/损伤过滤，mode=instances）
3. **静态补全**
   - Data `kc_get` / `kc_query` 舰种与数值
4. **玩家装备**
   - Poi `poi_query_equipment`（默认 aggregate；配装时再 instances）
   - Data `kc_equipment_rules` 校验能否装备
5. **组合**
   - Main Agent 输出编成 + 装备 + 替代

## 输出模板

```
推荐编成：
1. 舰娘名 Lv.X — 装备 A/B/C
2. …

替代方案：
装备 A 缺 → 用 B（影响：…）

路线/条件：
制空约 X / 索敌约 Y / 注意 Z

风险与备注：
中破进击不可 / 桶数建议 …
```

## 硬规则

- 禁止推荐玩家没有的装备而不说明「需获取」
- 缺顶级装备必须给替代：`装备 A → 可替换为 B`
- 优先使用玩家舰娘等级与损伤状态；重伤/入渠中不进主力
- 联合舰队问题区分一队/二队

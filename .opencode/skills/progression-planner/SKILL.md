---
name: progression-planner
description: 练舰规划、改造规划、账号发展、资源与短板。处理「我现在应该练谁」。
---

# Progression Planner Skill

**时期：练舰/改造价值基于二期环境。**

## 触发

练谁 / 改造目标 / 账号发展 / 资源规划 / 短板。

## 工作流

1. **玩家舰娘与等级**
   - Poi `poi_query_ships`（可按 damage 过滤排除大破）
2. **改造链**
   - Data `kc_ship_remodel`
   - 找出「接近下一改」的候选（差级小、价值高）
3. **价值**
   - kcwiki-researcher 查当前版本重要舰娘（活动刚需、炮航巡、特殊装备搭载）
4. **资源**
   - Poi `poi_get_overview` / `poi_get_inventory`

## 输出（必须明确排序）

```
第一优先：舰名（当前 Lv → 目标 Lv，理由）
第二优先：…
第三优先：…
暂时不用练：…
资源注意：桶/开发/改修是否卡脖子
```

## 硬规则

- 禁止只说「各有优缺点」
- 改造等级以 Data MCP 为准，不靠记忆
- 大破/入渠中不作为近期练级首选
- 短板要结合玩家已有高等级船，避免推荐重复功能船

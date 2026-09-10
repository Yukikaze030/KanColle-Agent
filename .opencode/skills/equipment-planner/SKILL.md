---
name: equipment-planner
description: 装备库存、改修优先级、价值判断、重复装备处理。处理「应该优先改什么」「值不值得 +10」。
---

# Equipment Planner Skill

## 触发

改修优先级 / 装备价值 / 库存 / 重复处理 / 装备缺口。

## 工作流

1. **库存**
   - Poi `poi_query_equipment` mode=aggregate
   - 注意 improvement 分布（+0/+6/MAX）
   - Poi `poi_get_inventory` 取改修资材 / 开发资材 / 桶
2. **静态**
   - Data `kc_get` 装备属性
   - Data `kc_query` 同类对比
3. **价值**
   - 缺数据时 kcwiki-researcher 查当前版本评价
4. **排序**
   - Main Agent 给明确优先级

## 输出模板

```
优先级 1：XX +6 → MAX
原因：…
成本：改修资材约 …（若无精确数据则声明需 Wiki/估算）
你已有：aggregate 结果
替代品：…

优先级 2：…
暂时不用：…
```

## 硬规则

- 默认 aggregate，禁止无必要返回上千实例
- 「值不值得改」必须结合玩家现有同类数量
- 改修精确消耗若本地 Data 无结构化数据 → 声明不确定，必要时 Wiki
- 陆基航空装备与舰载装备规则不同，先用 `kc_equipment_rules`

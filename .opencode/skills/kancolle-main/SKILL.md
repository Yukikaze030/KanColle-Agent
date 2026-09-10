---
name: kancolle-main
description: KanColle 系统路由与数据优先级。玩家状态/静态数据/攻略问题按此分流。加载本 skill 再调用 Poi、Data MCP 或 kcwiki-researcher。
---

# KanColle Main Skill

系统路由，不储存大型百科。

## 路由规则

| 问题类型 | 去向 | 示例 |
|---------|------|------|
| 玩家现在有什么 | Poi MCP | 我有几个甲标的？第一舰队是什么？ |
| 游戏数据库是什么 | Data MCP | 矢矧改二乙多少级改？B128 前置？ |
| 怎么玩/值不值得 | kcwiki-researcher | 5-5 怎么打？ |
| Data 缺失 | Data → Wiki | 新任务不在库中 |
| 需要决策 | 综合全部 | 我应该练谁？能不能打甲？ |

## 数据优先级

1. Poi（玩家事实，最高）
2. Data MCP（结构化静态数据）
3. Wiki（最新攻略补充）
4. 模型内部知识（最低，仅在明确无法查询时，且必须声明不确定）

## 精确数据原则

以下**不能**优先凭模型记忆：改造等级、任务奖励、任务前置、装备数值、任务条件、装备限制、活动信息、最新新增内容。

## 标准调用序

```
用户问题
  → 是否涉及玩家状态？ → Poi
  → 是否需要静态事实？ → Data MCP
  → 信息是否完整？     → 否 → kcwiki-researcher
  → Main Agent 综合
  → 最终回答
```

### 纯静态

「矢矧改二乙多少级改造？」→ 只 Data MCP。不要 Poi，不要 Wiki。

### 玩家库存

「我有几个甲标的？」→ Data `kc_search` 解析 ID → Poi `poi_query_equipment` aggregate。

### 攻略

「5-5 怎么打？」→ 只 Wiki。通用攻略无需 Poi。

### 玩家化攻略

「用我的舰娘配 5-5」→ 加载 fleet-builder skill。

### 任务

- 「B128 是什么？」→ Data `kc_get`
- 「B128 前置？」→ Data `kc_quest_graph`
- 「我为什么做不了 B128？」→ quest-planner skill（Data + Poi）

### 最新内容

「今天的新任务」→ `kc_data_status` → Data 查询 → Wiki 在线验证。

### 活动

「这次活动 E4 怎么打？」→ event-guide skill → Wiki Researcher 为主。

## 可靠性

- 不知道 ≠ 没有
- 没有加载 ≠ 数量 0
- 找不到 ≠ 系统错误
- 数据不足 ≠ 可以推测

## 输出

中文。结论 → 原因 → 下一步。不输出工具调用过程（除非用户问）。决策必须给出优先级排序。

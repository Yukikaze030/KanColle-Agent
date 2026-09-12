# Skills

Skills 存工作流，不存大规模数据。按需加载。

| Skill | 提示词 Token（约） | 职责 |
|-------|-----------|------|
| kancolle-main | 664 | 系统路由 |
| quest-planner | 274 | 任务链/卡关 |
| fleet-builder | 232 | 配队/替代 |
| equipment-planner | 213 | 改修/库存 |
| progression-planner | 225 | 练舰/发展 |
| event-guide | 205 | 活动（必须在线） |
| combat-knowledge | 180 | 战斗概念 |

## 加载与 Token 控制

游戏请求先加载 `kancolle-main`；纯静态、库存等简单查询直接路由工具，复杂规划只加载相关专项 Skill。专项 Skill 共享主 Skill 约束，无需重复加载已在上下文中的内容。

按目标筛选 MCP 查询，装备优先聚合，分配具体装备才取实例。同回合已核实结果可复用；玩家状态变化时刷新。Wiki 仅查相关页面，向 researcher 传必要摘要。

上表为首轮精简的计数快照；后续增加资材核实规则后不代表当前文件大小。以下首轮对比使用 `tiktoken` 的 `o200k_base` 对完整文件（含 frontmatter）计数，作为可比较的文本体积指标，不代表实际模型计费：

| 首轮范围 | 优化前 | 优化后 | 减少 |
|---|---:|---:|---:|
| 7 个 Skill + 主 Agent | 4110 | 2101 | 48.9% |
| 主 Agent + 主 Skill | 1423 | 772 | 45.7% |
| 主 Agent + 主 Skill + 配队 Skill | 1861 | 1004 | 46.1% |

基线为 `1a3cbad`。统计不含 AGENTS.md、researcher、工具 schema、工具返回与对话历史；所有 Skill 的总量也不等于每轮加载量。真实收益需在相同请求、玩家数据与模型下比较实际输入/输出 Token 及工具调用。后续重点检查全库存返回、任务图深度、Wiki 摘要体积，以及精简后是否仍正确核实改造形态、区分 unknown 状态并在线查询活动。

## 关系

```
              kancolle-main
                    │
     ┌──────────────┼──────────────┐
     ▼              ▼              ▼
quest-planner  fleet-builder  equipment-planner
     │              │              │
     └──────────┐   │   ┌──────────┘
                ▼   ▼   ▼
           Data / Poi / Wiki

     progression-planner
     event-guide
     combat-knowledge
```

## 禁止

- 在 SKILL.md 列出 500 件装备属性
- 复制完整计算公式数十页
- 把活动特例写进 skill 而不标注时效

需要属性 → Data MCP。精确机制 → kcwiki-researcher。

## 改造资材回归场景

- 来源写「新型兵装资材」，库存列出相似名称：保留全名，核对道具身份，不展开成航空/火炮二选一。
- 改造链仅有等级：不能当作完整消耗；缺项交 researcher 定向核实。
- 某一已知资源不足、另一消耗未知：可以判断暂不能改，不能断言唯一瓶颈或排序不变。
- 两个候选共用同一份资源：按推荐顺序累计扣减，不能同时标记都可执行。

Data MCP 现已支持 item 的 search/query/get，并按有向转换返回改造消耗与缺失字段；Poi inventory 提供 useitems 的 master_id/name/count 与覆盖状态。旧 fixture 不含消耗时返回 partial。数据层回归已覆盖道具区分、循环转换和缺项；以上规划行为仍需模型端联调。

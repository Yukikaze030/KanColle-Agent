# Skills

Skills 存工作流，不存大规模数据。按需加载。

| Skill | Token 预算 | 职责 |
|-------|-----------|------|
| kancolle-main | 3K–6K | 系统路由 |
| quest-planner | 1K–3K | 任务链/卡关 |
| fleet-builder | 1K–3K | 配队/替代 |
| equipment-planner | 1K–3K | 改修/库存 |
| progression-planner | 1K–3K | 练舰/发展 |
| event-guide | 1K–2K | 活动（必须在线） |
| combat-knowledge | 2K–4K | 战斗概念 |

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

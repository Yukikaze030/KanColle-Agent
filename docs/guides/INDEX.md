# 攻略网址总索引（二期 only）

> era: 2 | updated: 2026-09-12 | 所有链接仅作入口；正文以精简 MD 与在线二期页为准。

## 权威入口

| 站点 | URL | 语言 | 优先级 |
|------|-----|------|--------|
| 中文舰娘百科 | https://zh.kcwiki.cn | zh | 1 |
| 日文攻略 Wiki | https://wikiwiki.jp/kancolle | ja | 2 |
| English KC Wiki | https://en.kancollewiki.net | en | 3 |

## 按主题（Skill 附属）

| 主题 | Skill | 附属文档 | 推荐检索 |
|------|-------|----------|----------|
| 任务链/前置 | quest-planner | `.opencode/skills/quest-planner/refs/` | `site:zh.kcwiki.cn 任务` |
| 海域/活动路线 | event-guide, fleet-builder | 各自 `refs/` | `site:wikiwiki.jp/kancolle 海域` |
| **常规图带路/出击配置** | fleet-builder | `fleet-builder/refs/maps-routing.md` | https://bbs.nga.cn/read.php?tid=23451223 |
| 改修/装备价值 | equipment-planner | `.opencode/skills/equipment-planner/refs/` | `site:zh.kcwiki.cn 改修` |
| 练舰/改造价值 | progression-planner | `.opencode/skills/progression-planner/refs/` | 改二是否存在→Data MCP |
| **舰娘性能概述** | progression-planner | `progression-planner/refs/ship-perf-nga.md` | **MCP 优先**；NGA tid=34119362 可选 |
| 战斗公式 | combat-knowledge | `.opencode/skills/combat-knowledge/refs/` | 二期公式页 |
| 路由/系统 | kancolle-main | 本文件 + SKILL | — |

## 落盘文档

（随实现逐步填充）

- [x] quest-planner/refs/SOURCES.md + quest-notes.md
- [x] event-guide/refs/SOURCES.md
- [x] fleet-builder/refs/SOURCES.md
- [x] equipment-planner/refs/SOURCES.md
- [x] progression-planner/refs/SOURCES.md
- [x] combat-knowledge/refs/SOURCES.md

## 抓取约定

```text
websearch 二期关键词
→ webfetch 精确页
→ 去导航/广告
→ 只留：结论 / 条件 / 数值 / 不确定项 / 来源
→ 存入 skill/refs/<topic>.md
```

禁止把整页 HTML 或一期段落原样写入 refs。

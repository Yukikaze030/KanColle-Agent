---
feature: v1-kancolle-agent
status: designed
updated: 2026-01-15
branch: main
commits: TBD
---

# KanColle Agent V1

## Report

## [S1] Problem

玩家需要一个能结合「实时账号状态 + 结构化游戏数据 + 最新 Wiki 攻略」的个人舰これ助手，而不是单纯百科或凭模型记忆猜数的聊天机器人。

## [S2] Design

### 架构

```
User → Main Agent (kancolle)
         ├─ Skills (workflow)
         ├─ Poi MCP (player live state, HTTP localhost)
         ├─ Data MCP (static master data, stdio)
         └─ kcwiki-researcher (wiki research subagent)
```

### 组件

| 组件 | 包/路径 | 职责 |
|------|---------|------|
| Shared | `@kancolle-agent/shared` | Ref / Result / Common Types |
| Data MCP | `@kancolle-agent/data-mcp` | 静态数据 7 tools，stdio |
| Poi Plugin | `poi-plugin-kancolle-mcp` | Snapshot + 8 MCP tools，localhost HTTP |
| Runtime | `.opencode/` + `opencode.jsonc` | Agents / Skills / Config |

### 数据可靠性契约

- 不知道 ≠ 没有
- 没有加载 ≠ 数量 0
- 找不到 ≠ 系统错误
- 数据不足 ≠ 可以推测

### MCP Tools（共 15）

**Poi (8)**: `poi_status` `poi_get_overview` `poi_query_ships` `poi_query_equipment` `poi_get_fleets` `poi_get_quests` `poi_get_inventory` `poi_get_operations`

**Data (7)**: `kc_search` `kc_get` `kc_query` `kc_quest_graph` `kc_ship_remodel` `kc_equipment_rules` `kc_data_status`

### V1 明确不做

自动游戏、RAG、Vector DB、Wiki MCP、完整战斗历史、云同步。

## [S3] Out of Scope

- 自动出击/远征/改修/拆解
- RAG / Embedding / Vector DB
- OpenCode Plugin API
- V1.1 结构化改修/掉落数据

## Tasks

- [ ] T1: monorepo + shared types — acceptance: build & typecheck pass (covers: S2)
- [ ] T2: data-mcp tools + fixtures + tests — acceptance: vitest green (covers: S2; depends: T1)
- [ ] T3: poi-plugin-mcp snapshot + tools + tests — acceptance: vitest green (covers: S2; depends: T1)
- [ ] T4: OpenCode agents/skills/config — acceptance: files exist and follow token budget guidance (covers: S2; depends: T1)
- [ ] T5: scripts + docs — acceptance: verify script exits 0 when packages built (covers: S2; depends: T2,T3)
- [ ] T6: git commit trail + remote push — acceptance: remote has implementation commits (covers: S2; depends: T1,T2,T3,T4,T5)

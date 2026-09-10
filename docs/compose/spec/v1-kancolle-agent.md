---
feature: v1-kancolle-agent
status: delivered
updated: 2026-01-15
branch: main
commits: 82308fa..HEAD
---

# KanColle Agent V1

## Report

**What was built** — 按设计文档实现了完整 V1 monorepo：`@kancolle-agent/shared`（Ref/Result/Snapshot 类型）、`@kancolle-agent/data-mcp`（7 个 stdio 工具 + fixtures + 内存索引/任务图/改造树/装备规则）、`poi-plugin-kancolle-mcp`（SnapshotStore、normalize、8 个 localhost MCP 工具、Bearer 鉴权、mock 玩家与 API event 适配）、OpenCode 运行时（kancolle / kcwiki-researcher agents + 7 个 skills + opencode.jsonc）、安装/校验脚本与文档。数据可靠性契约（unknown≠absent、not_loaded≠0）在 Result 层与工具返回中落实。

**Verification** — `npm run build` PASS；`npm test` shared 9 + data-mcp 12 + poi 19 = 40/40 PASS；`npx tsx scripts/verify.ts` PASS；独立 review subagent：Spec compliance PASS，无 critical correctness bug。

**Journey log**
1. 大型 greenfield 用 fixtures 保证 Data/Poi 可离线测，真实 kancolle-data 可用 `KANCOLLE_DATA_PATH` 替换。
2. 改造链不能只跟 `remodel_to` 线性走，改二乙是分支，需 `remodel_from` 树 + visited 防环。
3. `kc_search` 只返回 ranked hits；`ambiguous` 留给解析类工具（get/remodel/rules）。
4. Review 指出的 medium 项（search 死分支、remodel DFS 环、equipment freshness、data_status 空数组、死代码）已在交付前修复并回归。
5. 远端推送与 upstream 绑定是 T6 最后一步，见后续 commit。

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

- [x] T1: monorepo + shared types — acceptance: build & typecheck pass (covers: S2)
- [x] T2: data-mcp tools + fixtures + tests — acceptance: vitest green (covers: S2; depends: T1)
- [x] T3: poi-plugin-mcp snapshot + tools + tests — acceptance: vitest green (covers: S2; depends: T1)
- [x] T4: OpenCode agents/skills/config — acceptance: files exist and follow token budget guidance (covers: S2; depends: T1)
- [x] T5: scripts + docs — acceptance: verify script exits 0 when packages built (covers: S2; depends: T2,T3)
- [x] T6: git commit trail + remote push — acceptance: remote has implementation commits (covers: S2; depends: T1,T2,T3,T4,T5)

---
name: fleet-builder
description: 用玩家现有舰娘与装备配队，校验路线、装备适配并给替代方案。
---

# 配队

遵循已加载的 `kancolle-main` 公共约束；若未加载，先加载。

1. **优先查数据源** `data/kancolle-maps/index.json`（海域↔HTML/pid/meta 映射，era=2）。按 map_id 读 `meta/<id>.json` 的 routing/enemy，或 `html/<id>.html`。
2. 可读精简版：`refs/maps/<图号>.md`（标题统一：地图信息 / 带路条件 / 敌方配置 / 制空索敌 / 推荐编成 / 任务配置）。
3. `poi_query_ships` 按舰种/等级/损伤筛选；`poi_query_equipment` 先 `aggregate`；`kc_equipment_rules` 校验适配。
4. 给出编成、等级、配装、路线条件与风险；联合舰队区分一/二队。

不把大破/入渠舰列入主力；未持有装备标明「需获取」。缺关键装备给可用替代及影响，不能把同一库存实例重复分配。改造形态须 Data MCP 核实。

## 数据源（Skill 外）

| 路径 | 用途 |
|------|------|
| `data/kancolle-maps/index.json` | 主索引：map_id → source_url / html / meta / skill_md |
| `data/kancolle-maps/meta/<id>.json` | 带路条件 + 敌方配置 raw |
| `data/kancolle-maps/html/<id>.html` | NGA 楼层原始 HTML |
| `data/kancolle-maps/SCHEMA.md` | maps/*.md 统一标题规范 |
| `refs/quest-sortie-configs.md` | 出击任务 → 海域/编成中央表（约 205 键） |

出击任务：Data MCP 拿任务 ID/名称 → `quest-sortie-configs.md` → 对应 `maps/<图>.md` 或 meta。

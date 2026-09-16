---
name: fleet-builder
description: 用玩家现有舰娘与装备配队，校验路线、装备适配并给替代方案。
---

# 配队

遵循已加载的 `kancolle-main` 公共约束；若未加载，先加载。

1. 先调用 Data `kc_map_guide(map=<图号>)` 只取模块目录，再按问题选择模块键；普通推图先取 `overview/routing/air-los/fleets`，问敌人或任务时才补 `enemy/quests`，不得默认读取全文。
2. Data 主表 `kc_get(map:...)` 只补地图静态字段；攻略模块缺失才读 `refs/maps/<图号>.md`，再按需查 `data/kancolle-maps/meta/<id>.json` 或 researcher。
3. Poi 优先用 `poi_query_fleet_assets` 两阶段查询：先按 `stype_ids/type_ids` 或少量 master ID 获取舰船实例与装备聚合；选定方案后只为最终装备取 `mode=instances`。只有通用分页或特殊字段才分别使用 `poi_query_ships` / `poi_query_equipment`。
4. 对最终舰娘用 `kc_ship_remodel` 核实形态，用 `kc_equipment_rules` 校验实际配装；有制空方案才调用 `kc_air_power`。给出编成、等级、配装、路线条件与风险，联合舰队区分一/二队。

不把大破/入渠舰列入主力；未持有装备标明「需获取」。缺关键装备给可用替代及影响，不能把同一库存实例重复分配。改造形态须 Data MCP 核实。

制空达标判断必须计入舰载机熟练度、装备改修、搭载数与适用机种补正；不得只用装备对空值与搭载数估算后否定方案。出击前本队制空优先调用 Data `kc_air_power`；航路损耗、基地航空队或防空等超出该工具范围时加载 `combat-knowledge`，由 researcher 核实二期公式或使用已验证计算器。本回合无法核实时只列候选方案并标注未核实。

## 数据源（Skill 外）

| 路径 | 用途 |
|------|------|
| `data/kancolle-maps/index.json` | 主索引：map_id → source_url / html / meta / skill_md |
| `data/kancolle-maps/meta/<id>.json` | 带路条件 + 敌方配置 raw |
| `data/kancolle-maps/html/<id>.html` | NGA 楼层原始 HTML |
| `refs/maps/FORMAT.md` | maps/*.md 固定模块键与标题规范；也是 `kc_map_guide` 的切片契约 |
| `refs/quest-sortie-configs.md` | 出击任务 → 海域/编成中央表（约 205 键） |

出击任务：Data MCP 拿任务 ID/名称 → `quest-sortie-configs.md` → 对应 `maps/<图>.md` 或 meta。

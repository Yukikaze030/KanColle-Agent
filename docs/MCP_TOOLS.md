# MCP Tools 参考

共 **18** tools：Poi 9 + Data 9。保留细粒度查询用于兼容与补查，常规配队优先使用组合查询和攻略切片工具。

## Poi MCP

### poi_status
无参数。返回 online / player_logged_in / snapshot_version / domains[]。

### poi_get_overview
无参数。资源、桶、开发/改修、容量、任务/远征/入渠计数、 sortie_active。

### poi_query_ships
参数：
- `instance_ids` `master_ids` `fleet_ids`
- `level: {min,max}` `locked` `damage[]` `condition{min,max}` `dock`
- `mode`: `instances` | `aggregate`
- `fields[]` `limit` (≤100) `cursor`

### poi_query_equipment
参数：`instance_ids` `master_ids` `improvement` `proficiency` `locked` `equipped`
`mode` 默认 **aggregate**。
`fields` `limit` `cursor`

### poi_query_fleet_assets
`ships?{master_ids,stype_ids,level,damage,dock,fleet_ids,limit}`
`equipment?{master_ids,type_ids,equipped,mode,limit}`
一次返回定向舰船候选和装备摘要；至少提供一个选择器。装备默认 aggregate，最终分配时才请求 instances。

### poi_get_fleets
参数：`fleet_ids?: [1..4]`（省略取全部）、`include_equipment?: boolean`（默认 true）。
返回 Fleet 1–4、联合角色、远征任务 ID/完成时间及按 `position` 排列的成员。
每舰含等级、HP、疲劳、入渠、`slot_items`、`slot_ex`，以及 `equipment_slots` / `expansion_slot` 的装备实例（名称、改修、熟练度、归属舰）；普通槽还含当前/最大搭载数。
`include_equipment=false` 省略装备明细，供成员摘要使用。
`coverage` 按 fleets/ships/equipment 标记加载情况；无舰队数据返回 `not_ready`，缺舰船/装备实例返回 `partial` + `missing`，保留未知槽位的实例 ID。增设槽区分 `closed` / `empty` / `equipped` / `unknown`。不得把未加载的空列表解释为没有舰队。

### poi_get_quests
参数：`state?` `limit?`
无记录 = unknown。

### poi_get_inventory
无参数。materials/useitems + coverage。

### poi_get_operations
无参数。expeditions / repairs / constructions / sortie / last_battle。

## Data MCP

### kc_search
`query` `limit?`(≤10) `types?`（ship/equipment/quest/expedition/map/item）
返回 `{ref,name,type,score}[]`，不返回完整实体。

### kc_get
`ref` `include?`（`remodel`|`graph`|`all`）

### kc_query
`entity` `filters?` `fields?` `limit?` `cursor?`；支持 item。通用 filters.ids（实体 ID 数组）/name（精确名称）。

### kc_quest_graph
`quest` `direction?` `depth?`
返回 nodes + edges（仅 ID/名称/关系）。

### kc_ship_remodel
`ship` `scope?`（默认 `next`，可选 `family`）
返回 `chain`（相关形态列表，不表示执行顺序）、`transitions`（有向改造及消耗）、`coverage`。
`next` 仅返回当前形态的直接转换；`family` 返回整个相关系列的转换。
每条转换含 `from/to/level/resources/items/equipment/coverage/missing/sources`。
道具 ref 为 `item:N`，消耗装备 ref 为 `equipment:N`；resources 使用与 Poi 相同的键。
未知消耗为 null 并返回 partial；终点的空 transitions 只有 coverage=complete 时才代表无下一改。

### kc_equipment_rules
`ship?` `equipment?` `category?` `mode?`=`check`|`who` `limit?`

### kc_improvement

`equipment?` `equipment_ids?` `assistant_ship?` `owned_ship_ids?` `weekday?` `date?` `all_days?` `include_costs?` `limit?`

数据固定来自 `http://fleet.diablohu.com/arsenal/` 的本地规范化缓存。默认使用东京当天；支援舰按具体 master ID/改造形态匹配，不合并同舰家族。

### kc_map_guide
`map` `modules?`
不传 `modules` 时只返回元数据与可用模块键/标题；传入 `overview/routing/enemy/air-los/bonus/fleets/quests/notes` 时仅返回所选模块。模块契约见地图 `FORMAT.md`。

### kc_air_power

输入具体装备（名称或 `equipment:N`）、搭载数、改修与显示熟练度，返回逐格及总制空值。未提供内部熟练度时返回该显示等级对应的范围；可传 `target_air_power` 得到三态 `meets_target`。当前只计算出击前本队制空，不包含航路损耗、基地航空队或防空。

### kc_data_status
无参数。version / commit / era / counts / capabilities / provenance / warnings。provenance 将转换的来源键映射为固定提交 URL。

## Token 预算

| 类型 | 默认 limit | 硬上限 |
|------|-----------|--------|
| Ships | 20 | 100 |
| Equipment instances | 20 | 100 |
| Quests | 20 | 100 |
| Search | 5 | 10 |

大型查询必须支持 `cursor` 与 `fields`。

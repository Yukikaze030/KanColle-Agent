# MCP Tools 参考

共 **15** tools：Poi 8 + Data 7。勿继续拆成 30–50。

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

### poi_get_fleets
无参数。Fleet 1–4 + 联合 + 远征状态。

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

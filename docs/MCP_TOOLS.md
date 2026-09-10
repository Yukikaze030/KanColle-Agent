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
`query` `limit?`(≤10) `types?`
返回 `{ref,name,type,score}[]`，不返回完整实体。

### kc_get
`ref` `include?`（`remodel`|`graph`|`all`）

### kc_query
`entity` `filters?` `fields?` `limit?` `cursor?`

### kc_quest_graph
`quest` `direction?` `depth?`
返回 nodes + edges（仅 ID/名称/关系）。

### kc_ship_remodel
`ship`
返回改造链与 remodel_level。

### kc_equipment_rules
`ship?` `equipment?` `category?` `mode?`=`check`|`who` `limit?`

### kc_data_status
无参数。version / commit / counts / capabilities。

## Token 预算

| 类型 | 默认 limit | 硬上限 |
|------|-----------|--------|
| Ships | 20 | 100 |
| Equipment instances | 20 | 100 |
| Quests | 20 | 100 |
| Search | 5 | 10 |

大型查询必须支持 `cursor` 与 `fields`。

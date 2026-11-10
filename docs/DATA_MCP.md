# Data MCP

本地静态游戏数据服务。stdio。不依赖 Poi，无网络监听。

**游戏时期：只服务二期**（2023-05 服务器迁移后）。`kc_data_status` 返回 `era: "2"`。

## 职责

回答：**游戏数据库里是什么？（二期）**

## 架构

```
MCP Tools
   │
   ▼
Normalized Service
   │
   ├── Entity Index
   ├── Quest Graph
   └── Rule Engine
         │
         ▼
   Data Adapter → fixtures / kancolle-data
```

## Tools（11）

| Tool | 说明 |
|------|------|
| `kc_search` | 名称/别名/WikiID/GameID → 小列表 |
| `kc_get` | 单实体；include 可选 remodel/graph |
| `kc_query` | 结构化筛选 + fields/limit/cursor |
| `kc_quest_graph` | 前置/后续节点边 |
| `kc_ship_remodel` | 相关形态、有向改造、等级、资源/道具/装备消耗；next/family 范围 |
| `kc_equipment_rules` | 舰种能否装备 / 谁能装备 |
| `kc_improvement` | 谁是呼叫舰队的每日改修日程、精确支援舰形态与阶段成本 |
| `kc_map_guide` | 按稳定模块键读取常规海域攻略；空选择只返回目录 |
| `kc_air_power` | 按装备、搭载、改修与熟练度计算出击前舰队制空值；内部熟练度未知时返回范围 |
| `kc_data_status` | 数据集版本与能力 |

## 数据源

### 正式库（默认）

```text
packages/kancolle-data-mcp/data/official/dataset.json
```

由 `npm run fetch:data` 生成：

| 实体 | 来源 |
|------|------|
| 舰娘主属性、改造关系、道具、部分特殊消耗 | `api/api_start2.json`，[2026-10-15 快照](https://github.com/kcwiki/kancolle-data/commit/7b92cdb8e4601fdec45ddd00489c7c6da9fa346d) |
| 开发/建造/改修资材、火炮资材、工廠资源消耗 | KC3Kai `RemodelDb.js`，[2026-10-15 规则](https://github.com/KC3Kai/KC3Kai/commit/86db000bea84a1ee94fef4f61bd5173737359f5c) |
| 舰娘补充属性 / 装备描述 | 舰娘补充表与主表同一提交，装备补充表固定至 [2026-11-03](https://github.com/kcwiki/kancolle-data/commit/4604fbccc6a7f0a3bf2ae5304778dda3c75a07f1) |
| 任务 | [`kcwiki-quest-data@0.8.0`](https://registry.npmjs.org/kcwiki-quest-data/0.8.0) |
| stype / 可装备规则 / 远征 / 海域 | 固定提交 `api/api_start2.json` |
| 常规海域攻略切片 | `fleet-builder/refs/maps/*.md`，固定标题按需读取 |
| 每日改修 | [是谁呼叫舰队 · 改修工厂](https://fleet.diablohu.com/arsenal/)，精确装备/舰娘 master ID、东京星期与阶段成本 |

固定快照包含 **舰船形态 866 · 改造转换 559 · 道具 105 · 装备 741 · 任务 446 · 远征 63 · 地图 37**。10 月主表只包含常规海域，前一份快照中的 5 张活动地图与 2 条活动支援任务已随上游移出。实际数量见 `kc_data_status`。

2026-11-11 核对时，改修工厂的 710 条记录与原快照逐条一致。任务包仍为 `0.8.0`，新实装任务缺失或资料不全时查 [任务来源](../.opencode/skills/quest-planner/refs/SOURCES.md)。

```bash
npm run fetch:data               # 用缓存和固定来源重建，已提交缓存支持离线
npm run fetch:data -- --refresh  # 重新下载主表与舰船、装备补充表，均使用固定提交
npm run fetch:improvements       # 拉取并重建改修工厂缓存
# 网络受限时，可提供与来源哈希一致的已下载 api_start2.json：
KANCOLLE_MASTER_FILE=/path/to/api_start2.json npm run fetch:data
```

GitHub raw 下载失败时，刷新脚本通过 Contents API 请求同一固定提交。

`kc_improvement` 只使用 `data/official/improvements.json`，不会在查询时改查 Wiki。支援舰按 master ID 精确绑定具体形态；例如 `ship:78` 金剛与 `ship:149` 金剛改二独立匹配。默认按东京当天查询，也可传 `date`、`weekday` 或 `all_days`。玩家可执行性由 Agent 将 Poi 的装备/舰娘 master ID 分别传入 `equipment_ids`、`owned_ship_ids` 后过滤。

### 回退 fixtures

```bash
KANCOLLE_DATA_SOURCE=fixture
# 或指定文件
KANCOLLE_DATA_PATH=/path/to/dataset.json
```

### 改造数据实现

`RemodelDb.js` 不是独立数据库：需要舰船主表和 `api_mst_shipupgrade`。本项目仅复用其消耗计算函数，不使用浏览器初始化、localStorage、按数量判断更新的缓存或缺项默认 0 的逻辑。

- 来源和 SHA-256 固定在 `scripts/remodel-sources.json`；vendor 保留 KC3Kai MIT 许可证。更新规则时必须同时更新源码、来源 pin 和哈希，并回归测试。主数据哈希基于 `JSON.stringify(JSON.parse(raw))`，规则哈希基于原文件字节。
- `remodel-master.json` 是主数据的精选缓存；`dataset.json` 是供 MCP 加载的规范化结果。主数据中的真实 ID 关系替代了名称推断。
- 消耗属于有向转换 `from → to`，支持循环；等级采用转换前条目的 `api_afterlv`。旧 `remodel_level` 兼容字段是最小入边等级，特定转换必须看 `transitions[].level`。
- `api_afterfuel` 对应 **steel**，`api_afterbull` 对应 ammo。设计图/详报/航空/兵装等来自改造主表；额外消耗来自 KC3 规则。
- `item:75`、`item:77`、`item:94` 是不同资材；锅炉消耗使用 `equipment:87`。道具查询支持 `kc_search(types=["item"])`、`kc_get(item:ID)`、`kc_query(entity="item")`。
- `scope=next` 默认仅返回当前形态的直接转换成本；`scope=family` 返回相关系列全部转换。`chain` 是形态遍历列表，不能在分支/循环中替代有向边。
- 返回 `resources/items/equipment/coverage/missing/sources`。缺表、缺必要字段、未知道具身份或未映射的新消耗字段会标记 partial，不按 0 处理；新 API 字段须适配后才能恢复完整。
- API 的 `api_boiler_count` 为已知可省略的零值字段；其他已建模的 count 字段缺失按未知。只有收到完整改造主表时，某舰没有特殊改造条目才可认定没有表内特殊消耗。
- 来源键对应 `kc_data_status.provenance` 的固定提交 URL。`coverage=complete` 仅表示已建模字段齐全，不等同于游戏内独立验证或永远最新。
- 旧 fixture/外部数据没有转换表时仍可查形态，但改造结果返回 partial。非法 ref、矛盾或重复转换、非法消耗不作为正常数据提供。

### 本次检查修复

- 删除按名称推断改造，避免分支/转换关系和等级失真。
- 增加完整消耗字段及独立道具查询，区分装备和道具库存。
- 类型过滤移到搜索截断之前；改造名称歧义返回候选，不猜同名条目。
- 改造接口拒绝非 ship ref；修复显式路径环境变量未生效、依赖 cwd 定位数据的问题。
- 修复入口模块被 import 时意外启动服务、依赖锁文件不同步和 verify 强制使用 Windows shell。

### 仍有缺陷 / 后续优先级

1. **装备适配已切换到固定 `api_start2` 主表**：普通槽使用舰种规则与舰船覆盖规则，增设槽使用 `api_mst_equip_exslot*`。规则无法判定时返回 `partial` 与 `can_equip: null`，不再把未知当作禁止。需要玩家等级的增设槽条件仍需结合 Poi 判断。
2. **非改造主数据已对齐同一主表版本**。装备、远征和地图从主表取条目，舰船回避、对潜、索敌优先取主表。任务保留上游的 `requirements`、说明及 `reward_other`。
3. **规则与版本时效**：KC3 规则有按舰 ID 的特判和默认值，新实装可能滞后。固定提交保证可复现，不自动保证最新；应定期对照游戏 main.js 或另一实现核验。不能把重新生成时间当作上游数据更新时间。
4. **账号可执行性尚由 Agent 计算**：Data MCP 返回成本，不扣玩家库存；多目标累计资源、已装备/锁定锅炉是否能消耗、玩家快照覆盖仍须结合 Poi 判断。本次未增加自动改造或游戏操作。
5. **其他解析器**：装备规则、任务图现在只接受唯一精确名称或显式 ref，多个精确同名会返回 `ambiguous`；Windows file URL 已统一转换为本地路径。任务和海域保留上游 ID 与结构化字段。常规图攻略可由 `kc_map_guide` 按稳定模块键读取本地 refs；缺项或最新变化仍转 researcher。

## 验证

`npm run verify` 执行构建和全部测试。回归包含资材 ID 区分、改造方向/循环、缺失字段、新增 API 字段、错误 ref、歧义名称、类型过滤、分页、外部数据校验与 MCP 协议调用。已用独立 stdio 进程从仓库外工作目录验证实际查询。玩家实时库存及模型端多舰规划仍需联调。

## Result 语义

- `ok` / `not_found` / `partial` / `ambiguous` / `error`
- `not_found` 是正常结果 → Main Agent 转 Wiki
- `partial` 带 `missing: [...]`
- `ambiguous` 返回 candidates，不自动猜

## 内存索引

启动时构建 shipsById/Name、equipmentById/Name、questsByGameId/WikiId/Name、expeditions、maps、任务前后置边。V1 不使用数据库。

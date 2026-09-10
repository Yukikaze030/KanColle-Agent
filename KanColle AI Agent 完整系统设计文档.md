# KanColle AI Agent 完整系统设计文档

版本：V1.0
目标运行环境：OpenCode / 兼容 Agent Harness
主要语言：TypeScript
设计目标：本地优先、低 Token、实时玩家状态、无需 RAG、模块可独立维护

------

# 1. 项目目标

构建一个面向《艦隊これくしょん -艦これ- / KanColle》的智能游戏助手。

系统能够理解：

- 玩家拥有哪些舰娘
- 玩家舰娘等级和状态
- 玩家拥有哪些装备
- 装备改修状态
- 玩家当前资源
- 玩家当前舰队
- 玩家任务状态
- 当前远征、入渠、出击状态
- 舰娘和装备的游戏静态数据
- 舰娘改造关系
- 装备可装备规则
- 任务关系
- 游戏机制
- 海域攻略
- 活动攻略
- 最新任务和游戏变化

最终让用户可以自然询问：

```text
我现在应该练谁？

我距离 B128 还有哪些任务？

我有没有做这个任务需要的舰娘？

我现在有什么陆攻？

我的矢矧应该怎么配？

这个装备值得改到 +10 吗？

我现在能不能打 5-5？

这次活动 E3 甲怎么配队？

我为什么这个任务没有完成？

我现在应该优先做什么？
```

系统不是单纯百科。

目标是：

```text
游戏事实
+
玩家事实
+
攻略知识
+
Agent 推理
=
针对当前玩家的具体建议
```

------

# 2. 总体架构

```text
                         ┌─────────────────────┐
                         │       用户          │
                         └─────────┬───────────┘
                                   │
                                   ▼
                     ┌──────────────────────────┐
                     │ KanColle Main Agent      │
                     │ 理解问题 / 综合决策      │
                     └────────────┬─────────────┘
                                  │
                     ┌────────────┼─────────────┐
                     │            │             │
                     ▼            ▼             ▼
              ┌───────────┐ ┌───────────┐ ┌───────────────┐
              │ Poi MCP   │ │ Data MCP  │ │ Skills        │
              └─────┬─────┘ └─────┬─────┘ └───────┬───────┘
                    │             │                 │
                    ▼             ▼                 ▼
              玩家实时数据    游戏结构化数据       工作流知识
                    │             │                 │
                    │             │                 │
                    └─────────────┼─────────────────┘
                                  │
                    数据不足 / 需要攻略 / 最新内容
                                  │
                                  ▼
                     ┌─────────────────────────┐
                     │ kcwiki-researcher       │
                     │ OpenCode Subagent       │
                     └───────────┬─────────────┘
                                 │
                 ┌───────────────┼────────────────┐
                 ▼               ▼                ▼
           中文舰娘百科        日文 Wiki        English Wiki
```

整个系统不使用：

```text
Vector DB
Embedding
RAG Server
WeKnora
Wiki MCP
```

Wiki 知识改为：

```text
websearch
→ 精确页面
→ webfetch
→ 子 Agent 摘要
→ Main Agent
```

------

# 3. 核心职责边界

整个系统必须严格遵守以下职责。

## Poi MCP

回答：

> 玩家现在有什么？

例如：

```text
舰娘
装备
等级
资源
任务状态
舰队
远征
入渠
当前出击
```

------

## KanColle Data MCP

回答：

> 游戏数据库里是什么？

例如：

```text
矢矧改二乙 master ID 是什么？
多少级改造？
装备火力多少？
某装备能不能被某舰装备？
某任务有哪些前置？
某远征基础数据是什么？
```

------

## Wiki Researcher

回答：

> 这东西怎么玩？

例如：

```text
5-5 怎么打？
这个任务有哪些坑？
这个装备值不值得改？
这次活动怎么打？
特殊攻击机制是什么？
```

------

## Skill

回答：

> 遇到某一类问题应该按照什么流程处理？

Skill 不储存大规模数据。

Skill 储存：

```text
路由规则
工作流程
判断方法
输出规则
工具调用策略
```

------

## Main Agent

负责：

```text
理解问题
↓
选择 Skill
↓
选择数据源
↓
组合数据
↓
发现缺失
↓
必要时启动 Wiki Researcher
↓
进行决策
↓
输出最终建议
```

------

# 4. 不采用 Wiki MCP

V1 不设计：

```text
Wiki MCP
```

原因：

Wiki 本质上属于：

```text
非结构化
动态
按需搜索
```

直接通过 Web Research 子 Agent 更合理。

因此：

```text
结构化数据
→ MCP

非结构化网页
→ Web Research Agent
```

------

# 5. 不采用 RAG

V1 不部署：

```text
Embedding Model
Vector Database
Document Parser
RAG Service
```

原因：

KanColle Wiki 已经可以在线访问。

RAG 会额外带来：

```text
文档同步
切片
Embedding
索引
数据库部署
更新
版本过期
迁移
```

因此直接：

```text
Search
→ Wiki Page
→ Summary
```

即可。

------

# 6. 最终组件清单

V1 系统包括：

```text
1. KanColle Main Agent

2. kcwiki-researcher Subagent

3. Poi Plugin

4. Poi MCP Server

5. KanColle Data MCP Server

6. KanColle Main Skill

7. Quest Planner Skill

8. Fleet Builder Skill

9. Equipment Planner Skill

10. Progression Planner Skill

11. Event Guide Skill

12. Combat Knowledge Skill

13. OpenCode 配置

14. 安装与更新脚本
```

------

# 7. 推荐项目结构

推荐使用 Monorepo：

```text
kancolle-agent/
│
├── README.md
├── SYSTEM_DESIGN.md
├── AGENTS.md
├── opencode.jsonc
│
├── .opencode/
│   │
│   ├── agents/
│   │   ├── kancolle.md
│   │   └── kcwiki-researcher.md
│   │
│   └── skills/
│       │
│       ├── kancolle-main/
│       │   └── SKILL.md
│       │
│       ├── quest-planner/
│       │   └── SKILL.md
│       │
│       ├── fleet-builder/
│       │   └── SKILL.md
│       │
│       ├── equipment-planner/
│       │   └── SKILL.md
│       │
│       ├── progression-planner/
│       │   └── SKILL.md
│       │
│       ├── event-guide/
│       │   └── SKILL.md
│       │
│       └── combat-knowledge/
│           └── SKILL.md
│
├── packages/
│   │
│   ├── poi-plugin-mcp/
│   │   ├── src/
│   │   ├── test/
│   │   ├── package.json
│   │   └── README.md
│   │
│   ├── kancolle-data-mcp/
│   │   ├── src/
│   │   ├── test/
│   │   ├── package.json
│   │   └── README.md
│   │
│   └── shared/
│       ├── refs.ts
│       ├── result.ts
│       └── types.ts
│
├── scripts/
│   ├── install.ts
│   ├── setup-opencode.ts
│   └── verify.ts
│
└── docs/
    ├── POI_MCP.md
    ├── DATA_MCP.md
    ├── MCP_TOOLS.md
    ├── SKILLS.md
    └── DEPLOYMENT.md
```

------

# 8. OpenCode AGENTS.md

`AGENTS.md` 必须非常短。

不要将整个 KanColle 游戏规则写入 `AGENTS.md`。

它只负责告诉主 Agent：

```text
这是 KanColle 项目。

处理 KanColle 用户请求时：

1. 加载 kancolle-main Skill。
2. 玩家状态使用 Poi MCP。
3. 静态游戏数据使用 KanColle Data MCP。
4. 在线 Wiki 查询交给 kcwiki-researcher。
5. 不根据模型记忆猜测精确游戏数据。
```

目标长度：

```text
< 500 Token
```

------

# 9. 为什么 AGENTS.md 要很短

`AGENTS.md` 属于长期上下文。

所以：

```text
AGENTS.md
= Bootstrap
```

而：

```text
Skill
= 按需加载
```

这样可以减少每轮 Context 消耗。

------

# 10. KanColle Main Agent

创建：

```text
.opencode/agents/kancolle.md
```

模式：

```text
primary
```

职责：

```text
理解用户需求

加载相关 Skill

调用 Poi MCP

调用 Data MCP

调用 kcwiki-researcher

综合结果

输出建议
```

------

# 11. Main Agent 工具权限

允许：

```text
Skill

Poi MCP

KanColle Data MCP

kcwiki-researcher Subagent
```

Main Agent 默认不要直接：

```text
webfetch 巨型 Wiki 页面
```

网页研究优先委派：

```text
kcwiki-researcher
```

从而避免污染主上下文。

------

# 12. kcwiki-researcher

类型：

```text
Subagent
```

核心职责：

```text
搜索 Wiki
读取相关页面
比较来源
提取必要内容
压缩结论
返回 Main Agent
```

它拥有独立 Context。

------

# 13. Wiki 数据源

默认顺序：

```text
1. zh.kcwiki.cn
   中文舰娘百科

2. wikiwiki.jp/kancolle
   日文攻略 Wiki

3. en.kancollewiki.net
   English Kancolle Wiki
```

------

# 14. Wiki 查询策略

禁止：

```text
用户问一个任务
↓
直接读取整个“任务”总页
```

应该：

```text
websearch

site:zh.kcwiki.cn "任务名称"

↓
找到相关具体页面

↓
webfetch

↓
只阅读相关内容
```

------

# 15. Wiki 默认优先级

普通问题：

```text
中文 Wiki
↓
如果足够
停止
```

中文 Wiki 缺失：

```text
中文
↓
日文
```

仍然不足：

```text
英文
```

------

# 16. 需要交叉验证的情况

以下情况允许查询多个 Wiki：

```text
最新任务

新活动

新舰娘

新装备

新改修

中文 Wiki 数据缺失

数据源描述冲突

复杂机制

翻译存在歧义
```

------

# 17. Wiki Researcher 输出限制

禁止返回完整网页。

标准输出：

```text
结论

关键条件

关键数值

攻略建议

不确定项

来源
```

目标：

```text
普通问题：
300～1000 Token

复杂攻略：
1000～2500 Token
```

------

# 18. kcwiki-researcher 不访问玩家数据

默认禁止它调用：

```text
Poi MCP
```

原因：

玩家状态已经由 Main Agent 管理。

Main Agent 可以把必要信息压缩后告诉 Researcher：

```text
玩家有：
矢矧改二乙
最上改二特
...
```

Researcher 不需要读取玩家整个账号。

------

# 19. Poi Plugin

项目：

```text
poi-plugin-mcp
```

运行于：

```text
Poi
```

职责：

```text
读取 Poi Redux

监听必要 KCSAPI Event

建立玩家 Snapshot

运行 Poi MCP Server
```

------

# 20. Poi Plugin 内部架构

```text
Poi Redux / Events
       │
       ▼
 ReduxAdapter
 ApiEventAdapter
       │
       ▼
   Normalizer
       │
       ▼
 PlayerSnapshot
       │
       ▼
 Player Services
       │
       ▼
   MCP Tools
```

------

# 21. Poi MCP 只读

V1 禁止：

```text
自动出击

自动装备

自动任务

自动远征

自动改修

自动拆解

自动建造
```

只提供读取。

------

# 22. Poi MCP Transport

推荐：

```text
Streamable HTTP
```

监听：

```text
127.0.0.1:<port>
```

原因：

Poi 本身是长期运行程序。

MCP Server 跟随 Poi 生命周期运行。

------

# 23. Poi MCP 鉴权

首次运行生成：

```text
独立 MCP Access Token
```

这个 Token：

```text
仅用于 MCP
```

禁止复用：

```text
游戏 Cookie
API Token
DMM Session
```

------

# 24. Poi MCP 玩家数据

主要负责：

```text
profile

resources

ships

equipment

fleets

quests

maps

repairs

constructions

expeditions

sortie

inventory

last battle
```

------

# 25. Poi Snapshot

核心结构：

```text
PlayerSnapshot

├── version
├── generated_at
│
├── profile
├── resources
├── ships
├── equipment
├── fleets
├── quests
├── maps
├── inventory
├── repairs
├── constructions
├── operations
│
└── freshness
```

------

# 26. Snapshot Version

任何有效玩家数据变化：

```text
version++
```

例如：

```text
1203
→
1204
```

所有 MCP 返回：

```text
snapshot_version
```

------

# 27. Poi 数据 Freshness

按 Domain 保存：

```text
ships.updated_at

equipment.updated_at

resources.updated_at

quests.updated_at

inventory.updated_at

operations.updated_at
```

绝不能认为：

```text
Poi 在线
=
全部数据一定最新
```

------

# 28. Poi ID 体系

舰娘：

```text
ship_instance:<instance_id>

ship:<master_id>
```

例如：

```text
ship_instance:82341

ship:699
```

------

装备：

```text
equipment_instance:<instance_id>

equipment:<master_id>
```

------

任务：

```text
quest:<game_id>
```

------

远征：

```text
expedition:<master_id>
```

------

道具：

```text
item:<master_id>
```

------

# 29. 为什么必须区分 Instance / Master

用户可能有：

```text
矢矧改二乙 Lv.98

矢矧改二乙 Lv.91
```

它们：

```text
master_id
相同

instance_id
不同
```

因此：

```text
instance ID
= 玩家实体

master ID
= 游戏实体
```

------

# 30. Poi MCP Tools

V1 固定：

```text
poi_status

poi_get_overview

poi_query_ships

poi_query_equipment

poi_get_fleets

poi_get_quests

poi_get_inventory

poi_get_operations
```

共：

```text
8 Tools
```

------

# 31. poi_status

功能：

```text
Poi 是否在线

玩家是否登录

各数据域是否加载

数据更新时间
```

------

# 32. poi_get_overview

返回精简：

```text
基础资源

桶

开发资材

改修资材

舰娘容量

装备容量

当前任务数

当前远征数

当前入渠数

是否出击
```

------

# 33. poi_query_ships

支持：

```text
instance_ids

master_ids

fleet_ids

level

locked

damage

condition

dock
```

支持：

```text
instances

aggregate
```

------

# 34. poi_query_equipment

支持：

```text
instance_ids

master_ids

improvement

proficiency

locked

equipped
```

默认：

```text
aggregate
```

避免将数千装备实例发送给模型。

------

# 35. poi_get_fleets

返回：

```text
Fleet 1～4

舰队成员

舰队状态

联合舰队

远征状态
```

------

# 36. poi_get_quests

返回：

```text
当前任务

任务进度

当前观察状态

插件观察历史
```

必须支持：

```text
unknown
```

------

# 37. Quest Unknown 原则

如果 Poi 当前没有某任务：

不能直接认为：

```text
未完成
```

只能在没有证据时返回：

```text
unknown
```

------

# 38. Quest History

Poi Plugin 安装以后可以记录：

```text
observed_completed
```

例如：

```text
quest:854

completed_at: ...
source: local_observed
```

但不能伪造插件安装之前的任务历史。

------

# 39. poi_get_inventory

返回：

```text
fuel

ammo

steel

bauxite

bucket

instant construction

development material

improvement material

useitems
```

------

# 40. Inventory Coverage

必须返回：

```text
complete

partial

not_loaded
```

例如：

```text
materials = complete

useitems = not_loaded
```

不能把：

```text
没有加载
```

解释成：

```text
数量 = 0
```

------

# 41. poi_get_operations

统一管理：

```text
expeditions

repairs

constructions

sortie

last_battle
```

避免继续增加很多细碎 MCP Tool。

------

# 42. Poi MCP Token 控制

默认：

```text
Ship limit = 20

Equipment instance limit = 20

Quest limit = 20
```

最大：

```text
100
```

所有大型查询支持：

```text
cursor
```

------

# 43. Fields

大型接口必须支持：

```text
fields
```

用户只需要舰娘等级：

```text
fields = [level]
```

就不要返回：

```text
完整装备
HP
经验
疲劳
```

------

# 44. Poi MCP Result

统一：

```text
status

data

snapshot

missing

warnings

error
```

status：

```text
ok

partial

stale

not_ready

not_found

unknown

error
```

------

# 45. KanColle Data MCP

项目：

```text
kancolle-data-mcp
```

这是：

```text
纯本地静态数据服务
```

它不依赖：

```text
Poi
```

------

# 46. Data MCP 数据源

主要：

```text
kcwiki/kancolle-data
```

补充：

```text
kcwikizh/kcwiki-quest-data
```

后续可增加：

```text
improvement data
```

------

# 47. Data MCP Transport

推荐：

```text
stdio
```

原因：

Data MCP 没必要长期开放网络端口。

OpenCode 可以：

```text
启动 Agent
↓
启动 Data MCP 子进程
↓
本地查询
```

没有：

```text
HTTP Port

Authentication

Network Exposure
```

------

# 48. Data MCP 架构

```text
                 MCP Tools
                     │
                     ▼
              Normalized Service
                     │
       ┌─────────────┼──────────────┐
       ▼             ▼              ▼
  Entity Index   Quest Graph    Rule Engine
       │             │              │
       └─────────────┼──────────────┘
                     ▼
                Data Adapter
                     │
          ┌──────────┴───────────┐
          ▼                      ▼
  kancolle-data             quest-data
```

------

# 49. Data MCP Tools

V1：

```text
kc_search

kc_get

kc_query

kc_quest_graph

kc_ship_remodel

kc_equipment_rules

kc_data_status
```

共：

```text
7 Tools
```

------

# 50. kc_search

用于：

```text
名称
别名
Wiki ID
Game ID
```

解析为：

```text
Canonical Ref
```

例如：

```text
矢矧改二乙
↓
ship:699
```

------

# 51. kc_search 输出必须小

返回：

```text
ref
name
type
score
```

不返回完整实体。

默认：

```text
limit 5
```

最大：

```text
10
```

------

# 52. kc_get

根据 Ref 获取单个游戏实体。

例如：

```text
ship:699

equipment:169

quest:854

expedition:37
```

支持：

```text
include
```

只有请求时返回大型关联字段。

------

# 53. kc_query

结构化筛选。

例如：

```text
所有轻巡

所有火力 >= 10 的装备

某舰种

某类型远征
```

必须：

```text
fields

limit

cursor
```

------

# 54. kc_quest_graph

专门处理：

```text
前置任务

后续任务

完整任务链
```

输入：

```text
quest

direction

depth
```

返回：

```text
nodes

edges
```

Graph 默认只包含：

```text
ID
名称
关系
```

不返回每个任务完整正文。

------

# 55. kc_ship_remodel

负责：

```text
舰娘改造链

改造等级

可确认的改造要求
```

例如：

```text
矢矧
→
矢矧改
→
矢矧改二
→
矢矧改二乙
```

------

# 56. kc_equipment_rules

负责：

```text
某舰能否装备某装备

普通槽能否装备

增设槽能否装备

某装备可被哪些舰种使用
```

这些规则在 MCP 内计算。

不要让 LLM 自己解析底层 master data。

------

# 57. kc_data_status

返回：

```text
数据集版本

Commit

更新时间

能力
```

用于判断：

```text
本地数据是否可能过期
```

------

# 58. Data MCP Result

统一：

```text
ok

not_found

partial

ambiguous

error
```

------

# 59. Data MCP NOT_FOUND

例如：

```text
新任务不存在
```

这是正常结果。

Main Agent 应：

```text
NOT_FOUND
↓
Wiki Researcher
```

而不是停止回答。

------

# 60. Data MCP PARTIAL

例如：

```text
任务存在

奖励存在

详细完成条件不存在
```

返回：

```text
partial

missing:
requirements
```

Main Agent：

```text
↓
Wiki
```

------

# 61. Data MCP AMBIGUOUS

例如：

```text
“大和”
```

如果可能指：

```text
大和

大和改

大和改二
```

返回候选。

不要 MCP 自动猜。

------

# 62. Data MCP 内存索引

Server 启动建立：

```text
shipsById

shipsByName

equipmentById

equipmentByName

questsByGameId

questsByWikiId

questsByName

expeditionsById

mapsById

itemsById
```

V1 不需要：

```text
PostgreSQL

SQLite

Redis

Vector DB
```

------

# 63. Main Skill

名称：

```text
kancolle-main
```

职责：

```text
系统路由
```

它不储存大型游戏百科。

------

# 64. Main Skill 核心规则

```text
如果问题涉及玩家：
→ Poi

如果问题涉及静态数据：
→ Data MCP

如果问题涉及攻略：
→ Wiki Researcher

如果 Data MCP 缺失：
→ Wiki Researcher

如果问题需要决策：
→ 综合全部数据
```

------

# 65. Main Skill 数据优先级

玩家状态：

```text
Poi
```

静态数据：

```text
Data MCP
```

Wiki：

```text
补充
```

模型内部知识：

```text
最后选择
```

------

# 66. 精确数据原则

以下内容不能优先凭模型记忆：

```text
改造等级

任务奖励

任务前置

装备数值

任务条件

装备限制

活动信息

最新新增内容
```

优先查询结构化数据。

------

# 67. Online Fallback

Data MCP：

```text
not_found
partial
```

或者用户询问：

```text
为什么

怎么打

怎么配

值不值得
```

调用：

```text
kcwiki-researcher
```

------

# 68. Quest Planner Skill

Skill：

```text
quest-planner
```

用于：

```text
任务链

任务前置

任务规划

任务卡住

奖励获取路径
```

------

# 69. Quest Planner Workflow

例如：

> 我怎么拿精锐水雷战队司令部？

流程：

```text
Data MCP

找到奖励任务
↓
Quest Graph
↓
完整前置链
```

然后：

```text
Poi MCP

查询这些任务的玩家状态
```

得到：

```text
A observed_completed

B observed_completed

C active

D unknown
```

再判断下一步。

------

# 70. Quest Wiki Fallback

如果 Data MCP 缺：

```text
详细编成条件

Boss 胜利要求

指定舰娘

次数

特殊限制
```

启动：

```text
kcwiki-researcher
```

只查询目标任务。

------

# 71. Quest 输出

默认：

```text
目标任务

当前状态

前置路径

下一步任务

完成条件

奖励

注意事项
```

不要输出整个任务数据库。

------

# 72. Fleet Builder Skill

Skill：

```text
fleet-builder
```

负责：

```text
配队

舰娘选择

装备选择

替代方案
```

------

# 73. Fleet Builder Workflow

用户：

> 用我现有舰娘配一队 5-5。

流程：

```text
Wiki Researcher
↓
查询 5-5 当前推荐路线/条件

Poi
↓
查询相关舰种玩家舰娘

Data
↓
补充舰娘类型、装备规则

Poi
↓
查询玩家可用装备

Main Agent
↓
组合配队
```

------

# 74. Fleet Builder 原则

禁止推荐不存在的装备而不说明。

输出：

```text
推荐舰娘

推荐装备

替代装备

路线条件

制空/索敌要求

注意事项
```

缺少顶级装备时：

```text
装备 A
→ 可替换为 B
```

------

# 75. Equipment Planner Skill

名称：

```text
equipment-planner
```

负责：

```text
装备库存

改修规划

装备价值

重复装备处理

装备缺口
```

------

# 76. Equipment Planner Workflow

用户：

> 我现在应该优先改什么？

流程：

```text
Poi
↓
装备库存
改修等级
改修资材

Data
↓
装备基础属性
升级关系

Wiki
↓
当前版本装备价值

Main Agent
↓
优先级
```

------

# 77. Equipment Planner 输出

例如：

```text
优先级 1：
XX +6 → MAX

原因：
...

成本：
...

你已有：
...

替代品：
...
```

------

# 78. Progression Planner Skill

名称：

```text
progression-planner
```

用于：

```text
练舰规划

改造规划

账号发展

资源规划

舰队短板分析
```

------

# 79. Progression Workflow

用户：

> 我现在应该练谁？

查询：

```text
Poi
↓
玩家舰娘 + 等级

Data
↓
改造链

Wiki
↓
重要舰娘当前价值
```

输出：

```text
第一优先

第二优先

第三优先

暂时不用练
```

必须给明确排序。

------

# 80. Event Guide Skill

名称：

```text
event-guide
```

负责：

```text
当前活动

E1/E2/E3...

甲乙丙丁选择

锁船

路线

Boss

配队
```

------

# 81. Event Guide 必须在线查询

活动属于强时间敏感数据。

流程必须：

```text
Wiki Researcher
↓
确认当前活动
↓
查询最新攻略
```

不能仅依赖模型内部知识。

------

# 82. Event Guide 玩家化

如果用户要求：

> 我能不能打甲？

再调用：

```text
Poi

舰娘库存
装备库存
资源
桶
```

然后：

```text
Main Agent
```

判断。

------

# 83. Combat Knowledge Skill

名称：

```text
combat-knowledge
```

负责：

```text
制空

索敌

昼战

夜战

触接

弹着

特殊攻击

对潜

陆航

支援

联合舰队
```

------

# 84. Combat Skill 内容原则

Skill 可以保存：

```text
稳定概念

查询流程

重要术语
```

不要保存：

```text
几十页完整计算公式

大量装备数据

活动特例
```

精确复杂机制：

```text
Wiki Researcher
```

------

# 85. Skill 之间的关系

```text
                kancolle-main
                      │
       ┌──────────────┼──────────────┐
       │              │              │
       ▼              ▼              ▼
 quest-planner   fleet-builder   equipment-planner
       │              │              │
       └──────────┐   │   ┌──────────┘
                  ▼   ▼   ▼
             Data / Poi / Wiki

       progression-planner

       event-guide

       combat-knowledge
```

------

# 86. Skill 不应该复制数据

错误：

```text
equipment-planner/SKILL.md

列出 500 件装备属性
```

正确：

```text
需要属性
→ Data MCP
```

------

# 87. Skill 大小目标

建议：

```text
kancolle-main
3K～6K Token

quest-planner
1K～3K

fleet-builder
1K～3K

equipment-planner
1K～3K

progression-planner
1K～3K

event-guide
1K～2K

combat-knowledge
2K～4K
```

因为 Skill 按需加载，不会每次全部塞入 Context。

------

# 88. MCP Tool 总量

Poi：

```text
8
```

Data：

```text
7
```

总共：

```text
15 MCP Tools
```

这是一个合理范围。

不要继续拆成：

```text
30～50 Tools
```

------

# 89. 为什么不把每个实体做一个 Tool

不建议：

```text
get_ship
get_ship_type
get_equipment
get_enemy
get_item
get_map
...
```

因为每个 Tool 都有：

```text
name

description

JSON Schema
```

这些都会消耗模型上下文。

Data MCP 用：

```text
search

get

query
```

统一低层实体。

复杂领域才单独 Tool。

------

# 90. 完整查询路由

Main Agent 应遵循：

```text
用户问题
    │
    ▼
是否涉及玩家状态？
    │
   YES
    ▼
Poi MCP
    │
    ▼
是否需要静态事实？
    │
   YES
    ▼
Data MCP
    │
    ▼
信息是否完整？
    │
   NO
    ▼
Wiki Researcher
    │
    ▼
Main Agent
    │
    ▼
最终回答
```

------

# 91. 纯静态问题

用户：

> 矢矧改二乙多少级改造？

流程：

```text
Data MCP
```

即可。

不要调用 Poi。

不要调用 Wiki。

------

# 92. 玩家库存问题

用户：

> 我有几个甲标的？

流程：

```text
Data MCP
↓
resolve equipment IDs

Poi MCP
↓
aggregate inventory
```

无需 Wiki。

------

# 93. 攻略问题

用户：

> 5-5 怎么打？

流程：

```text
Wiki Researcher
```

如果只是通用攻略：

无需 Poi。

------

# 94. 玩家化攻略

用户：

> 用我的舰娘帮我配 5-5。

流程：

```text
Fleet Builder Skill

Wiki
+
Poi
+
Data
```

------

# 95. 任务问题

用户：

> B128 是什么？

```text
Data MCP
```

------

用户：

> B128 前置是什么？

```text
Data MCP Quest Graph
```

------

用户：

> 我现在为什么做不了 B128？

```text
Quest Skill

Data
+
Poi
```

需要时：

```text
+ Wiki
```

------

# 96. 最新任务

用户：

> 今天的新任务怎么做？

流程：

```text
Data Status
↓
Data 查询
↓
Wiki 在线验证
```

因为最新数据可能尚未同步。

------

# 97. 当前活动

用户：

> 这次活动 E4 怎么打？

直接：

```text
Event Guide
↓
Wiki Researcher
```

Data MCP 可以补充舰娘装备静态数据，但不能作为当前活动攻略主要来源。

------

# 98. 信息可信度

玩家状态：

```text
Poi
```

最高。

静态 Master Data：

```text
Data MCP
```

优先。

最新攻略：

```text
当前 Wiki
```

优先。

模型内部记忆：

```text
最低
```

------

# 99. Wiki 冲突规则

如果 Wiki 不一致：

检查：

```text
更新时间

内容对应版本

是否活动限定

是否旧机制

日文原始描述
```

不能偷偷选择一个。

必要时告诉用户存在差异。

------

# 100. 统一 Ref 标准

全系统共享：

```text
ship:<master_id>

ship_instance:<instance_id>

equipment:<master_id>

equipment_instance:<instance_id>

quest:<game_id>

expedition:<id>

map:<area>-<map>

enemy:<id>

item:<id>
```

------

# 101. Ref 是系统之间唯一连接方式

例如 Poi：

```text
master_ref:
ship:699
```

Data：

```text
kc_get(ship:699)
```

无需：

```text
矢矧改二乙
```

再次名称解析。

------

# 102. Main Agent 不处理底层 ID 映射

底层数据库差异必须：

```text
Adapter Layer
```

解决。

不能把复杂底层格式推给 LLM。

------

# 103. 安全边界

Poi MCP：

```text
只监听 localhost

独立 Access Token

只读

过滤认证信息
```

------

# 104. Wiki Researcher 安全边界

只访问：

```text
公开网页
```

默认优先：

```text
zh.kcwiki.cn

wikiwiki.jp/kancolle

en.kancollewiki.net
```

------

# 105. Data MCP 安全边界

使用：

```text
stdio
```

没有网络监听。

------

# 106. Token 预算目标

Main Agent 正常请求：

```text
System / Agent Bootstrap
+
Main Skill
+
15 个简洁 Tool Schema
+
当前对话
```

数据输出严格裁剪。

普通问题目标：

```text
MCP Result
100～1000 Token
```

------

# 107. 禁止“大返回”

禁止：

```text
所有舰娘

所有装备实例

所有任务

整个 quest.json

Wiki 整页大型聚合表
```

进入主 Context。

------

# 108. Wiki Token 隔离

例如 Researcher：

```text
网页读取 20K Token
```

最终只返回：

```text
800 Token
```

Main Agent 只承担：

```text
800 Token
```

而不是 20K。

------

# 109. MCP Search + Get 模式

Data MCP：

```text
kc_search
↓
ref
↓
kc_get
```

这样模糊搜索不会返回巨大对象。

------

# 110. Poi Aggregate 模式

玩家装备：

默认：

```text
aggregate
```

例如：

```text
一式陆攻
8 件

+0 × 5
+6 × 2
MAX × 1
```

而不是返回 8 个完整实例。

------

# 111. 数据更新

## Poi MCP

事件驱动：

```text
Poi Redux / API Event
↓
更新 Snapshot
```

实时。

------

## Data MCP

启动：

```text
加载本地 npm 数据
```

版本升级时：

```text
升级依赖
↓
重启 MCP
```

------

# 112. Data 自动更新

后续可以增加：

```text
npm dependency updater
```

但 V1 不需要后台自动下载。

保持：

```text
确定版本
可复现
```

更重要。

------

# 113. Wiki

天然实时在线。

无需本地同步。

------

# 114. 推荐部署形式

用户电脑：

```text
Windows
│
├── Poi
│     └── poi-plugin-mcp
│           └── localhost MCP
│
├── Node.js Runtime
│
├── OpenCode
│     │
│     ├── Data MCP (stdio)
│     ├── Poi MCP (localhost HTTP)
│     │
│     ├── Skills
│     └── Agents
│
└── Browser / KanColle
```

------

# 115. 最终用户安装目标

最好最终做到：

```text
1. 安装 Poi Plugin

2. 安装 KanColle Agent 包

3. 运行 setup

4. OpenCode 自动发现：
   Skills
   Agent
   Data MCP

5. 配置 Poi MCP Token

6. 开始使用
```

------

# 116. 不建议 V1 开发 OpenCode Plugin

V1 不必额外写：

```text
OpenCode Plugin
```

直接使用：

```text
.opencode
+
opencode.jsonc
+
安装脚本
```

即可。

原因：

减少一个需要维护的插件 API。

------

# 117. V2 可以增加 Bootstrap Plugin

未来可选：

```text
opencode-kancolle
```

只负责：

```text
自动注册 Poi MCP

自动注册 Data MCP

检查连接

安装 Skill
```

但它不包含游戏逻辑。

------

# 118. 配置文件

建议：

```text
config/
└── kancolle.json
```

例如：

```json
{
  "locale": "zh-CN",

  "wiki": {
    "primary": "zh",
    "fallback": [
      "ja",
      "en"
    ]
  },

  "poi": {
    "url": "http://127.0.0.1:<port>/mcp"
  }
}
```

Token 不提交 Git。

------

# 119. 日志

Poi Plugin：

```text
INFO
WARN
ERROR
DEBUG
```

禁止打印：

```text
Cookie

API Token

完整认证请求
```

------

Data MCP：

可以记录：

```text
dataset version

startup

query error
```

无需记录玩家数据，因为它根本不应该接触玩家数据。

------

# 120. 测试结构

## Poi MCP

测试：

```text
Snapshot

Ship Query

Equipment Aggregate

Fleet

Quest Unknown

Inventory Coverage

Operations

Pagination

Fields

Security

Lifecycle
```

------

## Data MCP

测试：

```text
Search

Get

Query

Quest Graph

Remodel

Equipment Rules

Alias

Multi-language

Not Found

Partial

Ambiguous
```

------

# 121. Integration Test

需要建立 Mock Player：

```text
mock-player-A
```

包含：

```text
舰娘

装备

资源

任务

舰队
```

然后测试完整链路。

------

# 122. Integration Case 1

用户：

> 我有没有矢矧改二乙？

流程：

```text
Data
kc_search
↓
ship:699

Poi
query master_id=699

↓
Main Agent
```

------

# 123. Integration Case 2

用户：

> 我下一步应该做哪个任务才能解锁 B128？

```text
Data
Quest Graph

+

Poi
Quest State

↓

Quest Planner

↓

回答
```

------

# 124. Integration Case 3

用户：

> 我现有装备能不能配出 5-5 队伍？

```text
Wiki Researcher
↓
5-5 Requirements

Poi
↓
Ships + Equipment

Data
↓
Equipment Rules

Fleet Builder
↓
配队
```

------

# 125. Integration Case 4

用户：

> 这次活动我能不能打甲？

```text
Event Guide

Wiki
↓
当前活动要求

Poi
↓
舰娘
装备
资源

Main Agent
↓
评估
```

------

# 126. Integration Case 5

用户：

> 精锐水雷战队司令部怎么获得？

```text
Data
↓
搜索装备

Data
↓
关联任务

Quest Graph

Poi
↓
任务状态

Wiki
↓
仅在详细条件缺失时查询

Main Agent
↓
具体路线
```

------

# 127. 主 Agent 输出风格

默认中文。

结构：

```text
先给结论

然后说明原因

最后告诉用户下一步做什么
```

不要输出工具调用过程，除非用户询问。

------

# 128. 决策问题必须给明确推荐

用户：

> 哪个更好？

不能只说：

```text
各有优缺点
```

应该：

```text
结合你当前账号：

优先 A

其次 B

C 暂时不用
```

然后解释。

------

# 129. 缺失信息

如果 Poi：

```text
unknown
```

明确说：

```text
当前 Poi 数据无法确认
```

而不是猜。

------

Data：

```text
not_found
```

自动尝试 Wiki。

------

Wiki：

也找不到：

```text
明确说明暂时无法确认
```

------

# 130. V1 开发阶段

## Phase 0

建立：

```text
Monorepo

Shared Ref Types

Shared Result Types

CI
```

------

# 131. Phase 1 — Data MCP

优先实现：

```text
kc_search

kc_get

kc_data_status
```

然后：

```text
kc_query

kc_quest_graph

kc_ship_remodel

kc_equipment_rules
```

原因：

Data MCP 最容易测试，不依赖游戏环境。

------

# 132. Phase 2 — Poi Plugin

实现：

```text
Poi Plugin 生命周期

Redux Adapter

Snapshot

MCP Server

poi_status
```

------

# 133. Phase 3 — Poi Core

实现：

```text
overview

ships

equipment

fleets
```

------

# 134. Phase 4 — Poi Extended

实现：

```text
quests

inventory

operations

battle result
```

------

# 135. Phase 5 — Agent

实现：

```text
kancolle Main Agent

kcwiki Researcher
```

------

# 136. Phase 6 — Skills

顺序：

```text
kancolle-main

quest-planner

fleet-builder

equipment-planner

progression-planner

event-guide

combat-knowledge
```

------

# 137. Phase 7 — Integration

完整测试：

```text
Poi
+
Data
+
Wiki
+
Skills
+
Main Agent
```

------

# 138. Phase 8 — Installer

完成：

```text
安装脚本

OpenCode Config

README

版本更新
```

------

# 139. V1 验收标准

系统完成后至少能正确处理：

```text
我有什么舰娘？

我有什么装备？

我有几个甲标的？

我的第一舰队是什么？

我现在多少资源？

谁在远征？

谁在入渠？

当前有哪些任务？

B128 是什么？

B128 前置是什么？

我距离 B128 还有多远？

矢矧多少级改二乙？

某舰能不能装备某装备？

我应该练谁？

我应该改什么装备？

帮我配 5-5。

当前活动怎么打？

用我的账号给活动配队。
```

------

# 140. V1 明确不实现

```text
自动游戏

自动点击

自动出击

自动远征

自动改修

自动拆解

自动任务

完整战斗历史系统

掉落统计平台

RAG

Vector DB

云账号同步

网页管理后台
```

------

# 141. 后续 V1.1

可以增加：

```text
装备改修结构化数据

开发数据

建造数据

敌编成数据

海域节点数据

初始装备

掉落结构化数据
```

------

# 142. V2

未来可以增加：

```text
资源历史

战斗历史

活动舰队保存

账号发展评分

长期改修规划

舰娘练级计划

任务图缓存

多配置文件

GUI
```

------

# 143. 不建议 AI 自动游戏

即使未来有操作能力，也应将：

```text
分析系统
```

和：

```text
操作系统
```

完全分离。

目前项目只做：

```text
Analysis Assistant
```

------

# 144. 系统最重要的四句话

整个项目开发时始终遵守：

```text
Poi MCP
= 玩家现在有什么。
KanColle Data MCP
= 游戏数据库是什么。
Wiki Researcher
= 游戏应该怎么玩。
Main Agent
= 根据这个玩家的情况，现在应该怎么做。
```

------

# 145. 最终数据流

```text
                         USER
                           │
                           ▼
                    Main Agent
                           │
                      Load Skill
                           │
            ┌──────────────┼───────────────┐
            │              │               │
            ▼              ▼               ▼
        Poi MCP        Data MCP        Need Knowledge?
            │              │               │
            │              │              YES
            │              │               │
            │              │               ▼
            │              │        kcwiki-researcher
            │              │               │
            │              │       ┌───────┼────────┐
            │              │       ▼       ▼        ▼
            │              │      ZH      JA       EN
            │              │       │       │        │
            │              │       └───────┼────────┘
            │              │               │
            └──────────────┼───────────────┘
                           │
                           ▼
                      Main Agent
                           │
                    综合 / 判断 / 推荐
                           │
                           ▼
                         USER
```

------

# 146. 最终软件层次

```text
Layer 5
──────────────────────────
Main Agent
决策层


Layer 4
──────────────────────────
Skills
工作流层


Layer 3
──────────────────────────
Wiki Researcher
知识层


Layer 2
──────────────────────────
Poi MCP
Data MCP
数据服务层


Layer 1
──────────────────────────
Poi Redux
KCSAPI
kancolle-data
quest-data
Wiki
数据源层
```

任何模块都不要跨层承担其他模块的职责。

------

# 147. 推荐最终仓库模块

```text
@kancolle-agent/shared

@kancolle-agent/data-mcp

poi-plugin-kancolle-mcp

@kancolle-agent/runtime
```

其中：

```text
shared
= Ref / Result / Common Types

data-mcp
= 静态数据

poi-plugin-kancolle-mcp
= 玩家数据

runtime
= OpenCode Agents / Skills / Config
```

------

# 148. Shared Ref Type

建议定义：

```ts
type MasterRef =
    | `ship:${number}`
    | `equipment:${number}`
    | `quest:${number}`
    | `expedition:${number}`
    | `enemy:${number}`
    | `item:${number}`
    | `map:${string}`;

type InstanceRef =
    | `ship_instance:${number}`
    | `equipment_instance:${number}`;
```

Poi 和 Data 两边引用相同。

------

# 149. Shared Result Philosophy

所有服务必须遵守：

```text
不知道
≠
没有

没有加载
≠
数量 0

找不到
≠
系统错误

数据不足
≠
可以推测
```

这是整个 KanColle Agent 数据可靠性的核心。

------

# 150. 最终项目目标

这个项目最终不是：

```text
“接了几个 MCP 的聊天机器人”
```

而应该成为：

```text
                   KanColle Knowledge
                          +
                   Player Live State
                          +
                   Structured Game Data
                          +
                   Agent Workflows
                          │
                          ▼
               Personal KanColle Copilot
```

让用户可以直接问：

```text
“以我现在这个号，下一步应该干什么？”
```

系统能够真正读取玩家数据、理解任务链、检查舰娘装备、查询最新攻略并给出具体行动建议。

这才是整个系统最终需要达到的目标。
# quest-planner · 攻略网址（二期）

era: 2 | updated: 2026-11-11 | summary: 任务链工具、最新实装任务与周期出击资料入口。

| 优先级 | 站点 | 基址 | 检索建议 |
|--------|------|------|----------|
| 0 | NGA 简易推荐海域配置 | https://bbs.nga.cn/read.php?pid=454450573 | 日/周/月/季常的推荐图与叠任务 |
| 0 | 单发任务链导图 | https://tsukinohashi.com/mission-manager/ | 单发任务前置关系；URL 十六进制位图保存手工进度 |
| 0 | 日文 Wiki 任务首页 | https://wikiwiki.jp/kancolle/任務/フロントページ | 按编成/出击/演习/远征/工厂等分类查询 |
| 0 | Poi Quest Information 2 | https://github.com/lawvs/poi-plugin-quest-2/ | 当前任务状态与祖先/后继图推断实现 |
| 1 | 中文舰娘百科 · 最新任务 | https://zh.kcwiki.cn/wiki/任务/最新任务 | 新增常驻任务、限时任务及条件 |
| 1 | 日文 Wiki · 新着任務 | https://wikiwiki.jp/kancolle/任務/新着任務 | 按实装日期交叉核对任务 |
| 2 | English KC Wiki · Quests | https://en.kancollewiki.net/Quests | 按分类或任务编号核对 |

## 使用

1. Poi `poi_get_quests` + Data `kc_quest_progress` 优先；纯静态链可用 `kc_quest_graph`
2. Data 的任务数据包 `kcwiki-quest-data` 仍为 `0.8.0`。新任务未命中或缺前置、条件、奖励时，委派 researcher 核对目标任务页。
3. 精简结论写入 `refs/`，禁止整页粘贴  

## 已落盘

- `refs/quest-state-model.md`：状态语义与 Poi 插件算法
- `refs/routine-sortie-configs.md`：周期出击任务推荐图
- `fleet-builder/refs/quest-sortie-configs.md`：单发出击任务中央配置表

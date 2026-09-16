# quest-planner · 攻略网址（二期）

era: 2 | updated: 2026-09-16

| 优先级 | 站点 | 基址 | 检索建议 |
|--------|------|------|----------|
| 0 | NGA 简易推荐海域配置 | https://bbs.nga.cn/read.php?pid=454450573 | 日/周/月/季常的推荐图与叠任务 |
| 0 | 单发任务链导图 | https://tsukinohashi.com/mission-manager/ | 单发任务前置关系；URL 十六进制位图保存手工进度 |
| 0 | 日文 Wiki 任务首页 | https://wikiwiki.jp/kancolle/任務/フロントページ | 按编成/出击/演习/远征/工厂等分类查询 |
| 0 | Poi Quest Information 2 | https://github.com/lawvs/poi-plugin-quest-2/ | 当前任务状态与祖先/后继图推断实现 |
| 1 | 中文舰娘百科 | https://zh.kcwiki.cn | `site:zh.kcwiki.cn 任务` / 任务编号 |
| 2 | English | https://en.kancollewiki.net | quest id |

## 使用

1. Poi `poi_get_quests` + Data `kc_quest_progress` 优先；纯静态链可用 `kc_quest_graph`
2. 缺 detailed 条件 → 按上表检索，只抓目标任务页  
3. 精简结论写入 `refs/`，禁止整页粘贴  

## 已落盘

- `refs/quest-state-model.md`：状态语义与 Poi 插件算法
- `refs/routine-sortie-configs.md`：周期出击任务推荐图
- `fleet-builder/refs/quest-sortie-configs.md`：单发出击任务中央配置表

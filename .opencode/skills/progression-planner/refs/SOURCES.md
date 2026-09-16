# progression-planner · 攻略网址（二期）

era: 2 | updated: 2026-09-14

| 优先级 | 站点 | 基址 / 具体页 | 用途 |
|--------|------|----------------|------|
| — | **Data MCP（权威）** | `kc_search` / `kc_get` / `kc_ship_remodel` | 舰娘属性、改造链与等级 |
| 0 | NGA 全舰娘性能简述 | https://ngabbs.com/read.php?tid=34119362 | 候选舰定位与同类比较 |
| 0 | NGA 常见船培养推荐 | https://ngabbs.com/read.php?tid=31509174 | 通用培养候选与阶段建议 |
| 0 | NGA 图纸船推荐 | https://ngabbs.com/read.php?tid=29107384 | 稀缺改造道具的投资价值 |
| 1 | 中文舰娘百科 | https://zh.kcwiki.cn | 舰名评价 / 活动刚需 |
| 2 | 日文 Wiki | https://wikiwiki.jp/kancolle | 改二 / 練習 |

## 使用

- **禁止**用 Wiki/NGA/记忆断言改二；先 Data `kc_ship_remodel`  
- 舰娘性能概述：优先 `kc_search` → `kc_get(ship:N)` 查火力/雷装/对空/装甲等  
- 三篇 NGA 帖只提供价值判断，不替代 MCP；按问题只读对应 ref，不一次加载全部

## 落盘

- [ ] `refs/ship-perf-nga.md`：恢复访问后补性能定位摘要
- [ ] `refs/training-policy.md`：恢复访问后补常见培养梯度摘要
- [ ] `refs/blueprint-policy.md`：恢复访问后补图纸投资梯度摘要

## 获取状态

2026-09-14：普通 HTTP 与搜索缓存返回 403，但已通过用户打开的 Codex 内置浏览器读取三个原帖正文。培养帖页面显示更新至 2025-03-16；图纸帖标题为“26.05.29 凉波改二补”，正文页显示更新至 2026-06-19；全舰性能帖为持续更新的多页长文。refs 只保存决策所需摘要，不复制全文。

## 本地优先约定

Skill 先读取 `INDEX.md` 并检索本目录。网页只用于补充本地未覆盖的新舰、后续实装改造、当前活动倍卡或当前掉落信息。社区摘要与 Data 冲突时，静态事实以 Data MCP 为准；社区价值判断需标明来源版本。

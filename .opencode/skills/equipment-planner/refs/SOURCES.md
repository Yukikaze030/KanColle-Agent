# equipment-planner · 攻略网址（二期）

era: 2 | updated: 2026-09-23

| 优先级 | 站点 | 基址 | 检索建议 |
|--------|------|------|----------|
| 1 | 是谁呼叫舰队·改修工厂 | http://fleet.diablohu.com/arsenal/ | 每日改修、星期、支援舰、成本 |
| 2 | 中文舰娘百科 | https://zh.kcwiki.cn | 装备机制与价值背景；不得用于每日改修日程 |
| 3 | 日文 Wiki | https://wikiwiki.jp/kancolle | 装备机制与价值背景；不得用于每日改修日程 |

## 使用

- 每日改修由 `scripts/fetch-improvement-data.mjs` 拉取并生成 `data/official/improvements.json`，Skill 只调用 `kc_improvement`。
- 支援舰保留网站舰娘 master ID；不同改造形态禁止归并。
- Wiki 仅可补充装备价值与机制背景，不可替代改修日程、支援舰或阶段成本。

## 落盘

- [ ] `refs/improvement-priority.md`

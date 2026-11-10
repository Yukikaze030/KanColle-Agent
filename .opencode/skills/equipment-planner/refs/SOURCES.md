# equipment-planner · 攻略网址（二期）

era: 2 | updated: 2026-11-11 | summary: 每日改修以改修工厂快照为准，Wiki 补充机制背景。

| 优先级 | 站点 | 基址 | 检索建议 |
|--------|------|------|----------|
| 1 | 是谁呼叫舰队 · 改修工厂 | https://fleet.diablohu.com/arsenal/ | 每日改修、星期、支援舰、成本 |
| 2 | 中文舰娘百科 · 明石的改修工厂 | https://zh.kcwiki.cn/wiki/明石的改修工厂 | 改修机制与装备价值背景 |
| 3 | 日文 Wiki · 改修工廠 | https://wikiwiki.jp/kancolle/改修工廠 | 改修机制与装备价值背景 |

## 使用

- 每日改修由 `scripts/fetch-improvement-data.mjs` 拉取并生成 `data/official/improvements.json`，Skill 只调用 `kc_improvement`。
- 支援舰保留网站舰娘 master ID；不同改造形态禁止归并。
- Wiki 仅可补充装备价值与机制背景，不可替代改修日程、支援舰或阶段成本。

## 落盘

- [ ] `refs/improvement-priority.md`

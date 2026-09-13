# Skill 附属攻略文档（二期）

本分支用途：把**二期**攻略网址写入 Skill，或把网页抓取后**精简为 Markdown**，作为 Skill 的附属查阅文档。

## 原则

1. **只收二期**（2023-05 后）。一期页不得作为依据。
2. Skill 正文保持短；长表、路线图、改修表放在 `refs/`。
3. 每个附属文档必须有：`era`、`source`（URL）、`updated`、`summary`。
4. 网页转 MD 时只保留结论/条件/数值，去掉导航与广告。
5. 优先官方/社区权威站，不贴盗站或过期一期贴。

## 目录

| 位置 | 用途 |
|------|------|
| `docs/guides/INDEX.md` | 总索引（网址 + 已落盘文档） |
| `docs/guides/index.html` | 本地浏览器总览（可选） |
| `.opencode/skills/<id>/refs/*.md` | 各 Skill 附属查阅页 |
| `.opencode/skills/<id>/refs/SOURCES.md` | 该 Skill 的网址清单 |

## 使用

- OpenCode：按 Skill 按需读 `refs/`，不要每次全量加载。
- 新增攻略：先加 `SOURCES.md` 链接，再写精简 MD，最后在 SKILL.md 加一行「附属文档」指针。

## 维护

```text
git checkout feat/skill-guide-refs
# 编辑 refs / INDEX
npm run verify   # 结构检查
git commit && git push -u origin feat/skill-guide-refs
```

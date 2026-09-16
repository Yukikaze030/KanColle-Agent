# 统一标题规范（maps/*.md）

MCP / Agent 使用固定模块键检索；中文标题仅供阅读。

## Frontmatter（必填）

```yaml
era: "2"
source: "<pid URL>"
updated: "YYYY-MM-DD"
summary: "常规图 <id> <日文名>（精简）"
map: "<id>"
fetch_status: "slimmed"
slimmed: true
```

## 二级标题（固定顺序）

| 标题 | 必须 | 内容 |
|------|------|------|
| `# [map:<id>] <id> <日文名>` | 是 | 一级标题 |
| `## [module:overview] 地图信息` | 是 | 一句话定位 / 血条 / 特殊机制 |
| `## [module:routing] 带路条件` | 是 | 路线、分歧条件、索敌/装备带路 |
| `## [module:enemy] 敌方配置` | 是 | 各点敌舰、制空均势/优势/确保 |
| `## [module:air-los] 制空 / 索敌` | 是 | 推荐制空与索敌阈值 |
| `## [module:bonus] 海域倍卡` | 否 | 海域特效或倍卡 |
| `## [module:fleets] 推荐编成` | 是 | 主流编成 / 流派 |
| `## [module:quests] 任务配置` | 是 | 出击任务推荐 |
| `## [module:notes] 备注` | 是 | 数据时代与核实边界 |

机器身份只使用 `[module:<key>]`；模块顺序、完整规则及校验脚本见 `.opencode/skills/fleet-builder/refs/maps/FORMAT.md`。

## 敌方配置压缩格式

```markdown
| 点 | 敌舰（压缩） | 制空均势 | 优势 | 确保 |
|----|--------------|----------|------|------|
| B | 重巡リ級flag, 駆逐ロ後×4 | — | — | — |
```

敌名可用缩写：`flag`=flagship, `後`=後期型, `空母ヲ` 等；保留关键 CV/BB/LHA。

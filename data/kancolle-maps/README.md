# KanColle 常规图数据源（Skill 外部数据）

本目录是 **fleet-builder / quest-planner 的数据源**，不是 Skill 正文。Agent 通过路径与 `index.json` 查询。

```text
data/kancolle-maps/
  index.json          # 海域 ↔ HTML/pid/md/meta 映射（主入口）
  SCHEMA.md           # 统一标题与字段规范
  html/<id>.html      # NGA 楼层原始 HTML
  raw/<id>.txt        # 楼层 innerText
  meta/<id>.json      # routing/enemy/analysis + source_url
```

## 查询方式

1. 读 `index.json` 得到 map_id → `source_url` / `html` / `meta` / `skill_md`
2. 需要带路/敌配细节 → `meta/<id>.json` 或 `html/<id>.html`
3. 需要精简可读版 → `.opencode/skills/fleet-builder/refs/maps/<id>.md`
4. 出击任务推荐 → `fleet-builder/refs/quest-sortie-configs.md`

## 来源

NGA tid=23451223（梦美常规图带路），era=2。

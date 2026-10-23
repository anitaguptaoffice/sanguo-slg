# 参照资料使用说明

本项目是某 SLG 页游的完整复刻重构。玩法、数值、交互流程以原版为准，
代码、表结构、文案、美术全部重新实现。

原版资料放在两个**未合并**的 PR 分支上，只读参照，禁止合并、禁止修改、禁止打包。

## 资料位置

| 分支 | 内容 | PR |
|---|---|---|
| `reference/legacy-source` | 原版服务端 PHP（732 文件）、客户端 SWF、483 表结构与全量数据 | #82 |
| `art/reference-assets` | 原版美术资源 6669 张 | #77 |

## 怎么取到本地（不要合并）

```bash
# 方式一：独立工作树，推荐
git fetch origin reference/legacy-source art/reference-assets
git worktree add ../rxsg-ref reference/legacy-source
git -C ../rxsg-ref checkout art/reference-assets -- reference/art

# 方式二：只导出文件，不建工作树
git archive origin/reference/legacy-source reference/ | tar -x -C /tmp/ref
git archive origin/art/reference-assets reference/art | tar -x -C /tmp/ref
```

## 目录对照

```
reference/legacy/
├── server/game/        126 个业务类，规则细节的主要出处
├── server/amfphp/      原版通信网关
├── server/config/      数据库、密钥、聊天服配置
├── manage/             运营后台
├── BandServer/         军团（联盟）服务
├── swf/ + BloodWar.swf 客户端，界面流程与交互顺序
└── db/
    ├── schema.sql      483 张表结构，无数据
    ├── bloodwar.sql.gz 全量数据（69 MB，压缩后 5.3 MB）
    └── TABLES.md       483 张表的行数与列数
```

## 查资料的固定路径

- **查规则**：`db/TABLES.md` 定位 `cfg_*` 表 → `db/schema.sql` 看字段 → `server/game/` 搜表名，读它的代码，公式就在附近。
- **查数值**：`cfg_*` 表是唯一来源。与 `spec/data/` 冲突时以原版为准，再决定是否调整。
- **查流程**：界面操作顺序看 `BloodWar.swf`，服务端处理顺序看 `server/game/`。
- **恢复全量数据**：`gunzip -c reference/legacy/db/bloodwar.sql.gz | docker exec -i rxsg-db mysql -uroot -p123456 bloodwar`

## 边界（必须遵守）

1. **只读**。不改 `reference/` 下任何文件，不把参照代码复制进 `internal/`。
2. **不照搬写法**。原版是 PHP 5.x 时代代码；只借鉴规则与流程，实现方式自己定。
3. **文案重写**。原文案只能当规则参考，新项目文案必须重写。
4. **美术重制**。`reference/art/` 只用于对标尺寸、配色、UI 密度，不进 `client/assets`，不随构建打包。
5. **不合并** PR #77 / #82。它们只作为参照物存在，合并会污染主分支。

## 一句话总结

规则看 `server/`，流程看 `swf/`，数值看 `db/`，视觉看 `art/`。看懂了就自己实现，不要复制。

## Wave 7 对齐波次

任务卡在 `tasks/backlog.yml`（`wave: 7`）。入口为 **SPEC-ALIGN-001**（对照 `TABLES.md` 定核心 `cfg_*` 子集行数上限），再 **DATA-001** 灌 `spec/data`（文案重写）。实现侧见 **PERSIST-***、**ECON-001**、**GM-002**、**RULES-ALIGN-001**；路线图见 [ROADMAP.md](ROADMAP.md)。

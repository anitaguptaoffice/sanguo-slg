# HERO-HOST-1001 slice:0 工程挂载验收（#108 编排用）

| 项 | 结果 | 备注 |
|---|---|---|
| 仅 2 ID / 4 PNG + manifest `slice:0` | PASS | 自 Draft #983 @ `eef9514b` 路径复制，未合并 #983 |
| 生产主城 mock 进服 → 将领面板 | PASS | `hero-panel-roster` preset，刘备 `template_cfg_id=1001` 详情非 hero not found |
| 56px 圆角头像 + 邻行文案 | PASS | probe `avatar.cssWidth/Height=56`，`borderRadius=50%`；见 `runtime/hero-host-1600x900-dpr1.jpg` |
| 半身 + 名称同帧（名称在半身右侧） | PASS（目视） | probe `nameBesideBust=false` 为叠压启发式；`headLeft` > `bustRight` 表示名称在右，见 dpr1/dpr2 截图 |
| 1280 列表滚动到底 | PASS | `1280x720-dpr1` 已滚到底；`scrollReachOk=true` |
| DPR2 走 2× 纹理 | PASS | dpr2 probe `usesAvatar2x` / `usesBust2x`，`artTextureScale=2` |
| 刘备 1001 面部比例 57.8% 特例 | 未自动测 | 美术 #108 注释接受；需目视 PNG / 美术复核 |
| `tip_sha` / `runtime_code_sha` / `art_head` | 见 probe | `runtime/probe-log.json` |

**SHA 绑定（捕获时工作树）**

- `tip_sha` / `runtime_code_sha`：工程分支 HEAD（捕获日志中为 main 基点 `0dab7176…`，合并 PR 后以 CI 绿提交为准）
- `art_head_sha`：`eef9514b507c3b21921987ab94232021422bdc2f`
- `main` 基点：`0dab7176596b255fcccb1b5c970655c86407ed28`

**产物路径**

- `docs/art/samples/hero-host-1001-slice0/runtime/*.jpg`
- `docs/art/samples/hero-host-1001-slice0/runtime/probe-log.json`
- `docs/art/samples/hero-host-1001-slice0/runtime/INVENTORY.md`

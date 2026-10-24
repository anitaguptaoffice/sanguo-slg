# 1280 bust+name sameframe — FAIL / pending host fix

**Art #108 comment [6388032901](https://github.com/anitaguptaoffice/sanguo-slg/pull/108#issuecomment-6388032901)**

Slice3（及 Slice4/5）的 `hero-host-1280x720-dpr1-bust-name-sameframe.jpg` **不得**作为美术签收或工程 PASS 依据，直至：

1. 生产 host 修复 scroll/clip（招募区等滚动祖先不再裁切半身）。
2. 探针改为对所有 **clipping ancestors ∩ viewport** 求交，而非仅 `window` 矩形。
3. 列表末将领需保证详情 **top + bottom** 均在可滚动视口内。

当前仓库内同帧 JPEG 仅作**参考截图**；`probe-log.json` 中 `sameframe.signoff.ok` 为 `false`，`status` 为 `FAIL_PENDING_HOST_FIX`。

**勿**基于裁切同帧图要求美术重签。共享 host+probe 由独立 agent 修复后统一重采。

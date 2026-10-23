# ART-SAMPLE-001 — GitHub 联调样件（非生产验收）

## 状态 / 依赖
- 样件契约：PR #100，`645b48886335ab6f9232443dd8cec26f41ba261f`；该 PR 未合并，接口/schema 仍为 DRAFT。此提交基于 main，不引入 #100、#77、#82 的提交。
- **艺术验收 BLOCKED**：2×背景为 **UPSCALED PLACEHOLDER**。原生仅 1786×881，放大至 3200×1576；不是新增高密度细节。不得宣称 18 张全部生产就绪。
- **运行时未测试**；preview.png 是 1600×900 静态拼装，不是游戏截图。schema 验证通过不等于 loader、图集、裁切或艺术验收通过。

## 工程接入
- 运行时路径：`client/public/assets/art/v1/manifest.json` 与 `textures/`，精确 18 张 standalone RGBA PNG。
- manifest 是供工程复核的样件映射，最终 manifest/loader 由工程维护。本 PR 不改 schema、游戏逻辑、服务器或协议。
- 工程可将本 PR **仅这一个资产提交** cherry-pick 到已含 #100 接口的联调分支；不要求先合并 #100 或本 PR，不自动合并。
- manifest 的 `base_url` 为 `/assets/art/v1/`；部署子路径由工程按 #100 契约处理。
- 六类：背景、主殿、农田、粮食、按钮四态、九宫格面板，全部 1×/2×。禁止自动 trim、atlas；省略 crop_offset。
- 外框 1600×900；舞台 1600×788、背景位于 (0,56)。槽位已含 HUD 56，不要再加 56。
- 主殿左上 (640,120)，农田左上 (180,380)；锚点见 manifest。九宫格每边 24 逻辑像素（2×纹理为 48 物理像素）；UI 不烘焙文字。

## 体积 / 验证
- 18 张 PNG 共 11,174,264 字节（约 10.66 MiB）；manifest 3,868 字节；预览 2,191,517 字节。未做生产压缩预算承诺。
- 对 GitHub PR100 指定 SHA 的原始 schema 执行 jsonschema 验证：PASS。
- PNG 解码、18 路径、尺寸、RGBA、SHA256 与交付 QA 一致；QA.json 记录逐张来源、缩放、padding 与哈希。
- QA 中 source 路径仅为私有源包来源标记，不表示 Git 内有这些文件；`high_density_art_accepted` 仅为分辨率技术标志，不是最终艺术通过。
- 建筑/粮食使用完整源画布 contain，未按 alpha 裁切；源 alpha 接触原画布边缘，不能保证生成源没有截边。不补绘、不换色、不清理细边。
- 背景整帧宽高比规范化约 0.158%，未裁切。透明边视觉记录仅静态审阅；不能替代引擎测试。
- 下一步由工程验证 loader/子路径、倍率选择、按钮四态、面板 480×300 九宫格拉伸和舞台落位；美术需替换真正原生高密度背景并复审。

仅提交本次重新制作的样件，不含原版参考素材、legacy 二进制、ZIP、原始大栅格或 LFS 配置改动。

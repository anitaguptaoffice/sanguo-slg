# ART-SAMPLE-001 背景 HD 修订候选

回应 [#108 工程反馈](https://github.com/anitaguptaoffice/sanguo-slg/pull/108#issuecomment-6365205102)，基于已含 [#112](https://github.com/anitaguptaoffice/sanguo-slg/pull/112) 的 main。

## 方法与边界
- **六块重新生成后拼接的 HD**，不是一次生成原生 3200×1576，也不是把旧 1786×881 整图放大。
- 六块实际生成图均 1448×1086，各等比降采样至 1200×900（比例 0.828729），按 3×2 排布，横向重叠 200px、纵向重叠 224px。
- 重叠区使用最小误差动态规划接缝及 20px smoothstep 羽化；最终 3200×1576。旧背景仅用于构图参考，不提供输出像素；未上采样生成像素。
- 2×转为完全不透明 RGBA PNG；1×从该完成图 LANCZOS 降采样至 1600×788。像素转换不增加细节。
- 完整来源尺寸、来源 SHA256、降采样比例、拼接范围、输出 SHA256/字节数见 [HD-BACKGROUND-PROVENANCE.json](HD-BACKGROUND-PROVENANCE.json)。来源文件仅保留 basename，不上传六张大源图。

## 不变项
`mc.bg.plateau.v1`、原路径、1×/2×尺寸、舞台 1600×788 @ y=56、manifest/schema/锚点全部不改。没有修改运行时代码、配置或协议。
官府/农田原图与布局保持不变；贴地/裁切属于可选后续议题，须先对齐裁切规范，不在本次静默修改。

## 验证与验收
- PNG 解码、实际尺寸、RGBA/全不透明、来源 SHA256 和无上采样比例核验通过。
- 静态整图/细节审阅未见明显接缝，仅为静态观察，不保证无接缝；[detail_comparison.png](detail_comparison.png) 是旧放大占位与新拼接候选对比，非游戏截图。
- **新背景引擎复验及最终艺术验收 PENDING**。请工程 DPR≥1.5 / DPR2 进入主城，检查实际选用2×、细节、接缝/色块、建筑槽位观感与部署路径，并回传截图；同时抽查 DPR1 的1×背景。
- #112 的旧版测试记录不自动覆盖本次新图。未运行 npm test/build 或游戏。
- 原 README/QA 与 preview.png 历史记录保留，QA 增补 current_background_revision。不能将本候选描述为生产艺术已通过。
- 不合并 #108/#100/#77/#82，也不自动合并本修订 PR。

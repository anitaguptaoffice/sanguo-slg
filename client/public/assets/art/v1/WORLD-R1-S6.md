# R1-S6 世界大地图资源包

原创等距世界地图资源，2026-11-20 由 `client/scripts/gen-world-art.mjs`
以矢量形状在 Chromium 中绘制并导出透明 PNG。未使用、描摹或裁切
`art/reference-assets` 的任何素材。

## 清单（22 项，1x/2x 各一份）

| 分组 | asset id | 逻辑尺寸 |
|---|---|---:|
| 地形 | `world.tile.{plain,desert,forest,grass,mountain,lake,swamp,city_ground}.v1` | 128×64 |
| 城池 | `world.obj.city.{village,town,capital}.v1` | 192×160 |
| 黄巾 | `world.obj.huangjin.v1` | 160×144 |
| 资源 | `world.obj.resource.{farm,lumber,quarry,iron}.v1` | 64×64 |
| 旗帜 | `world.flag.{self,ally,neutral,enemy}.v1` | 48×88 |
| 行军 | `world.march.{troop,returning}.v1` | 48×48 |

- 地形按 2:1 等距菱形绘制，顶点与相邻瓦片重合；`WorldMapScene` 以
  `2 * halfW × 2 * halfH` 精确铺贴，1280/1600 与 DPR 1/2 实测无黑缝。
- 城池外观由 `city_level`（官府等级）选择：1–3 村镇、4–7 城郭、8–10 巨城。
- 旗帜按归属选择：无主中立、己方为绿、其余为红；盟友旗已注册，等 R2
  联盟数据接入后启用。
- 资源地标只画在已占领野地与高等级野地上，避免整图噪声。

## 重新生成

```bash
cd client
CHROMIUM_PATH=/path/to/chrome node scripts/gen-world-art.mjs
```

输出覆盖 `public/assets/art/v1/textures/{1x,2x}/world/`。脚本无随机数，
同一 Chromium 版本产物一致。

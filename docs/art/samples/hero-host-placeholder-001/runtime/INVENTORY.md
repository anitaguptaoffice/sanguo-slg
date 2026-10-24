# HERO-HOST-PLACEHOLDER-001 runtime inventory

Git tip SHA: `fdba70377e15cc72d16e5bc3d323a333c54cc119`

Mode: Vite fixture mount (real AssetLoader + placeholder PNGs).

- `runtime/hero-host-1600x900-dpr1.jpg` — 1600×900 @ DPR 1, 34295 bytes, sha256 `35b384d972beb267c71757d55dcad829477df638cb699a0ef720bb20d50a9df2`
- `runtime/hero-host-1600x900-dpr2.jpg` — 1600×900 @ DPR 2, 89715 bytes, sha256 `93a280c593e4b4e1c2d4cc85728861dfce5b89541986a5bb3e47a29ce25c9e9a`
- `runtime/hero-host-1280x720-dpr1.jpg` — 1280×720 @ DPR 1, 29980 bytes, sha256 `a6e99311202f3789fc6921c7146d6e73ec09925c31e92bfd25e6b80f61c81f15`

## Textures (engineering placeholders)

- `client/public/assets/art/v1/textures/1x/hero/avatar/1001.png` — 157 bytes, sha256 `73c20ab3cdae04b500523a44e3344ada082e846c6726d5336b2a6b4867f27304`
- `client/public/assets/art/v1/textures/2x/hero/avatar/1001.png` — 333 bytes, sha256 `f269752a4f586e6c61b72be008ef463072237b6a618195e57f5d494716804a0f`
- `client/public/assets/art/v1/textures/1x/hero/bust/1001.png` — 511 bytes, sha256 `fb9a7fd133229f74d1aa91117615814366e7189fef3ed15534a890c4a34d446e`
- `client/public/assets/art/v1/textures/2x/hero/bust/1001.png` — 1702 bytes, sha256 `f51fd9b0e6d33448cbe6d1520598e0c71e6ca8f4bbc01050f8946961c69fb1af`

## Probe

```json
{
  "1600x900-dpr1": {
    "ok": true,
    "dpr": 1,
    "uiScale": 1,
    "avatar": {
      "width": 56,
      "height": 56,
      "borderRadius": "50%",
      "artTextureScale": "1"
    },
    "bust": {
      "width": 128,
      "height": 160,
      "float": "left",
      "artTextureScale": "1"
    },
    "layout": {
      "nameBesideBust": false,
      "headLeft": 639,
      "bustRight": 629
    },
    "scrollReachOk": true,
    "uses1x": true,
    "uses2x": false
  },
  "1600x900-dpr2": {
    "ok": true,
    "dpr": 2,
    "uiScale": 1,
    "avatar": {
      "width": 56,
      "height": 56,
      "borderRadius": "50%",
      "artTextureScale": "2"
    },
    "bust": {
      "width": 128,
      "height": 160,
      "float": "left",
      "artTextureScale": "2"
    },
    "layout": {
      "nameBesideBust": false,
      "headLeft": 639,
      "bustRight": 629
    },
    "scrollReachOk": true,
    "uses1x": false,
    "uses2x": true
  },
  "1280x720-dpr1": {
    "ok": true,
    "dpr": 1,
    "uiScale": 1,
    "avatar": {
      "width": 56,
      "height": 56,
      "borderRadius": "50%",
      "artTextureScale": "1"
    },
    "bust": {
      "width": 128,
      "height": 160,
      "float": "left",
      "artTextureScale": "1"
    },
    "layout": {
      "nameBesideBust": false,
      "headLeft": 639,
      "bustRight": 629
    },
    "scrollReachOk": true,
    "uses1x": true,
    "uses2x": false
  }
}
```
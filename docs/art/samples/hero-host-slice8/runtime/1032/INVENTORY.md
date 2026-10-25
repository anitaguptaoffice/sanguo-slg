# HERO-HOST-SLICE8 runtime inventory — template 1032

| Field | SHA |
|---|---|
| base_host_sha (Slice7 #1233 layout) | `035abdda48bdfab8bac44837c72afea76e9eae68` |
| evidence_head_sha / tip_sha / runtime_code_sha | `28c1d9ac92cfa45e5f957a96c572270ddfedb6c6` |
| art_head_sha (#1205) | `181b0191b834b2e0c3a983a7911690552fe143f0` |
| hero_mail_panels_blob_sha | `356f8e33734ca1374f3cf1ecd61368431293a93c` |
| capture_script_blob_sha (@ evidence_head) | `0dbec076dfb0bcfdcc26e73ebacc92314df9590c` |
| capture_script_blob_sha_at_pr_head (@ PR HEAD metadata) | `55de52015769d9dcd1c11ce6b5c087b3068953bc` |
| mock_blob_sha (@ evidence_head) | `5da72c80ae94fe397b7b554890170501844dacb4` |


## Viewport captures

- `runtime/1032/hero-host-1600x900-dpr1.jpg` — 1600×900 @ DPR 1, 463223 bytes, sha256 `8086c92c2359549604e9982e53dd2095fa86a0dd4e853e6abcb26a63ba1a091c`
- `runtime/1032/hero-host-1600x900-dpr2.jpg` — 1600×900 @ DPR 2, 969796 bytes, sha256 `9a70ecf380ff8a50aa37edecbf9557603bba2d19eee9058a8447bd0a7a1f9857`
- `runtime/1032/hero-host-1280x720-dpr1.jpg` — 1280×720 @ DPR 1, 248097 bytes, sha256 `d28cf08bbe373c82a796cbb6b4f56521b44d802975f6c6bc3051b95108fb84dc`
- `runtime/1032/hero-host-1280x720-dpr1-bust-name-sameframe.jpg` — 1280×720 bust+name same frame, sha256 `ec4d95c3d15b7ecaddc13115928e76bc4637a4a55c2372b1c57fb559fb2b8135`

## Textures (hero.avatar.1032.v1 / hero.bust.1032.v1)

- `client/public/assets/art/v1/textures/1x/hero/avatar/1032.png` — 6452 bytes, sha256 `d2b0fbe49eddfc6adb0999c7dd1e5170184022343abb28a945249a98429f55a8`
- `client/public/assets/art/v1/textures/2x/hero/avatar/1032.png` — 21313 bytes, sha256 `35991bbe0a6bab5ecbb40175dfb57b31d4cc527fd20143d197ffcf63c4b5d2cc`
- `client/public/assets/art/v1/textures/1x/hero/bust/1032.png` — 29749 bytes, sha256 `e55ca7553093eccf0e10b315d0ccd5d5bb7e2a51d0a4912105211fa20cce857b`
- `client/public/assets/art/v1/textures/2x/hero/bust/1032.png` — 101159 bytes, sha256 `1caf52f2df0fdfb8dda6a7ca391b33f13a0aeba52668ad00ca4fc8ae2001536d`

## Probe summary

```json
{
  "probes": {
    "1600x900-dpr1": {
      "ok": true,
      "template_cfg_id": 1032,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "徐晃",
      "listAvatarVisible": true,
      "listAvatarInClip": true,
      "listNameInClip": true,
      "listAvatarRoundMask": true,
      "listRowTemplateOk": true,
      "listAvatarFrameOk": true,
      "listRowPrimaryText": "徐晃 · Lv12 · 忠诚 88",
      "captureSectionsVisible": true,
      "dpr": 1,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1032.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1032.png",
        "float": "left",
        "marginRight": "10px"
      },
      "layout": {
        "nameBesideBust": false,
        "gapPx": 10,
        "nameBesideBustGapOk": true,
        "headLeft": 662,
        "bustRight": 652
      },
      "texturePickOk": true,
      "usesAvatar1x": true,
      "usesAvatar2x": false,
      "usesBust1x": true,
      "usesBust2x": false,
      "avatarPathOk": true,
      "bustPathOk": true,
      "scrollReachOk": true,
      "detailFooterVisible": true,
      "detailFooterTopInScroll": true,
      "detailFooterBottomInScroll": true,
      "bustNameInClip": false,
      "visibleClip": {
        "left": 524,
        "top": 3091.046875,
        "width": 128,
        "height": 0
      },
      "listVisibleClip": {
        "left": 516,
        "top": 657.765625,
        "width": 568,
        "height": 150.234375
      }
    },
    "1600x900-dpr2": {
      "ok": true,
      "template_cfg_id": 1032,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "徐晃",
      "listAvatarVisible": true,
      "listAvatarInClip": true,
      "listNameInClip": true,
      "listAvatarRoundMask": true,
      "listRowTemplateOk": true,
      "listAvatarFrameOk": true,
      "listRowPrimaryText": "徐晃 · Lv12 · 忠诚 88",
      "captureSectionsVisible": true,
      "dpr": 2,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "2",
        "srcTail": "2x/hero/avatar/1032.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "2",
        "srcTail": "2x/hero/bust/1032.png",
        "float": "left",
        "marginRight": "10px"
      },
      "layout": {
        "nameBesideBust": false,
        "gapPx": 10,
        "nameBesideBustGapOk": true,
        "headLeft": 662,
        "bustRight": 652
      },
      "texturePickOk": true,
      "usesAvatar1x": false,
      "usesAvatar2x": true,
      "usesBust1x": false,
      "usesBust2x": true,
      "avatarPathOk": true,
      "bustPathOk": true,
      "scrollReachOk": true,
      "detailFooterVisible": true,
      "detailFooterTopInScroll": true,
      "detailFooterBottomInScroll": true,
      "bustNameInClip": false,
      "visibleClip": {
        "left": 524,
        "top": 3097.046875,
        "width": 128,
        "height": 0
      },
      "listVisibleClip": {
        "left": 516,
        "top": 663.765625,
        "width": 568,
        "height": 144.234375
      }
    },
    "1280x720-dpr1": {
      "ok": true,
      "template_cfg_id": 1032,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "徐晃",
      "listAvatarVisible": true,
      "listAvatarInClip": false,
      "listNameInClip": false,
      "listAvatarRoundMask": true,
      "listRowTemplateOk": true,
      "listAvatarFrameOk": false,
      "listRowPrimaryText": "徐晃 · Lv12 · 忠诚 88",
      "captureSectionsVisible": true,
      "dpr": 1,
      "uiScale": 0.8,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1032.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1032.png",
        "float": "left",
        "marginRight": "10px"
      },
      "layout": {
        "nameBesideBust": false,
        "gapPx": 10,
        "nameBesideBustGapOk": true,
        "headLeft": 502,
        "bustRight": 492
      },
      "texturePickOk": true,
      "usesAvatar1x": true,
      "usesAvatar2x": false,
      "usesBust1x": true,
      "usesBust2x": false,
      "avatarPathOk": true,
      "bustPathOk": true,
      "scrollReachOk": true,
      "detailFooterVisible": true,
      "detailFooterTopInScroll": true,
      "detailFooterBottomInScroll": true,
      "bustNameInClip": false,
      "visibleClip": {
        "left": 364,
        "top": 374.15625,
        "width": 128,
        "height": 0
      },
      "listVisibleClip": {
        "left": 374,
        "top": 374.15625,
        "width": 550,
        "height": 0
      }
    }
  },
  "sameframe": {
    "ok": true,
    "bustInClip": true,
    "nameInClip": true,
    "bustInViewport": true,
    "nameInViewport": true,
    "nameRightOfBust": true,
    "verticalBandOverlap": true,
    "gapPx": 10,
    "gapNear10px": true,
    "visibleClip": {
      "left": 356,
      "top": 374.15625,
      "width": 568,
      "height": 301.046875
    },
    "name": {
      "text": "徐晃"
    },
    "viewport": {
      "w": 1280,
      "h": 720,
      "dpr": 1
    }
  }
}
```
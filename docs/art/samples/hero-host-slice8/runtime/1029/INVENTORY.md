# HERO-HOST-SLICE8 runtime inventory — template 1029

| Field | SHA |
|---|---|
| base_host_sha (Slice7 #1233 layout) | `035abdda48bdfab8bac44837c72afea76e9eae68` |
| evidence_head_sha / tip_sha / runtime_code_sha | `e5bfd0d0104934dc4442469b5c3aced37d06b5dd` |
| art_head_sha (#1205) | `181b0191b834b2e0c3a983a7911690552fe143f0` |
| hero_mail_panels_blob_sha | `356f8e33734ca1374f3cf1ecd61368431293a93c` |
| capture_script_blob_sha | `a3fddd850a348bd119bc29c2f330e8192627e5c8` |
| mock_blob_sha | `5da72c80ae94fe397b7b554890170501844dacb4` |


## Viewport captures

- `runtime/1029/hero-host-1600x900-dpr1.jpg` — 1600×900 @ DPR 1, 463428 bytes, sha256 `b1bb7dfeba2841feafd81ff844b6491ce14409e982d8f6fa8f7980654ab2a13c`
- `runtime/1029/hero-host-1600x900-dpr2.jpg` — 1600×900 @ DPR 2, 970352 bytes, sha256 `a58484ac66fc25cfcb4093d874878853e321fac69dc7b308f07a81f21077985d`
- `runtime/1029/hero-host-1280x720-dpr1.jpg` — 1280×720 @ DPR 1, 248093 bytes, sha256 `44ba9be570e19dbb97a72408d58780e7690fe88d03e3bf8c335e4a2f8971fc60`
- `runtime/1029/hero-host-1280x720-dpr1-bust-name-sameframe.jpg` — 1280×720 bust+name same frame, sha256 `e00102f0bffc9665225b5d15121caa2b8c08e23e5e5d9ab33ef828622654cd8f`

## Textures (hero.avatar.1029.v1 / hero.bust.1029.v1)

- `client/public/assets/art/v1/textures/1x/hero/avatar/1029.png` — 6378 bytes, sha256 `830c0b11065c7c79526d75f96dbcdf18cd8ab70822a8e522d2d1311020f8acea`
- `client/public/assets/art/v1/textures/2x/hero/avatar/1029.png` — 20797 bytes, sha256 `fc2a35daf2975a3e7c56e2df37723a871b0e2f37824e9eef663e35c5deff2ed4`
- `client/public/assets/art/v1/textures/1x/hero/bust/1029.png` — 28165 bytes, sha256 `6f9799f906d84fa973af095885a1b235b0f4cbb4dbd225908de78d721360bbaf`
- `client/public/assets/art/v1/textures/2x/hero/bust/1029.png` — 98641 bytes, sha256 `7a056ff6dbe61cacb734b4a1b229a691070ba14797391da0a0535e2ed933c098`

## Probe summary

```json
{
  "probes": {
    "1600x900-dpr1": {
      "ok": true,
      "template_cfg_id": 1029,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "夏侯惇",
      "listAvatarVisible": true,
      "listAvatarInClip": true,
      "listNameInClip": true,
      "listAvatarRoundMask": true,
      "listRowTemplateOk": true,
      "listAvatarFrameOk": true,
      "listRowPrimaryText": "夏侯惇 · Lv10 · 忠诚 84",
      "captureSectionsVisible": true,
      "dpr": 1,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1029.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1029.png",
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
        "top": 2135.046875,
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
      "template_cfg_id": 1029,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "夏侯惇",
      "listAvatarVisible": true,
      "listAvatarInClip": true,
      "listNameInClip": true,
      "listAvatarRoundMask": true,
      "listRowTemplateOk": true,
      "listAvatarFrameOk": true,
      "listRowPrimaryText": "夏侯惇 · Lv10 · 忠诚 84",
      "captureSectionsVisible": true,
      "dpr": 2,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "2",
        "srcTail": "2x/hero/avatar/1029.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "2",
        "srcTail": "2x/hero/bust/1029.png",
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
        "top": 2141.046875,
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
      "template_cfg_id": 1029,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "夏侯惇",
      "listAvatarVisible": true,
      "listAvatarInClip": false,
      "listNameInClip": false,
      "listAvatarRoundMask": true,
      "listRowTemplateOk": true,
      "listAvatarFrameOk": false,
      "listRowPrimaryText": "夏侯惇 · Lv10 · 忠诚 84",
      "captureSectionsVisible": true,
      "dpr": 1,
      "uiScale": 0.8,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1029.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1029.png",
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
      "text": "夏侯惇"
    },
    "viewport": {
      "w": 1280,
      "h": 720,
      "dpr": 1
    }
  }
}
```
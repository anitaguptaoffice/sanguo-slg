# HERO-HOST-SLICE8 runtime inventory — template 1030

| Field | SHA |
|---|---|
| base_host_sha (Slice7 #1233 layout) | `035abdda48bdfab8bac44837c72afea76e9eae68` |
| evidence_head_sha / tip_sha / runtime_code_sha | `e5bfd0d0104934dc4442469b5c3aced37d06b5dd` |
| art_head_sha (#1205) | `181b0191b834b2e0c3a983a7911690552fe143f0` |
| hero_mail_panels_blob_sha | `356f8e33734ca1374f3cf1ecd61368431293a93c` |
| capture_script_blob_sha | `a3fddd850a348bd119bc29c2f330e8192627e5c8` |
| mock_blob_sha | `5da72c80ae94fe397b7b554890170501844dacb4` |


## Viewport captures

- `runtime/1030/hero-host-1600x900-dpr1.jpg` — 1600×900 @ DPR 1, 463395 bytes, sha256 `c160566e1126c78e9825bd2d57790cd7693243d75cb8c186859bd075b7d8ff01`
- `runtime/1030/hero-host-1600x900-dpr2.jpg` — 1600×900 @ DPR 2, 970389 bytes, sha256 `16420645a586e965ae058df9e6b092c0cc2d2c457175862970e8b790eda6fec3`
- `runtime/1030/hero-host-1280x720-dpr1.jpg` — 1280×720 @ DPR 1, 247973 bytes, sha256 `af68ea367732a00b314975fc099f1aa1dffa9f639c493dbcfc3eb16b82b7eed9`
- `runtime/1030/hero-host-1280x720-dpr1-bust-name-sameframe.jpg` — 1280×720 bust+name same frame, sha256 `c421411ba1a072b2de820c9e4b418f7975a26f835e024c5569b6b1a6e1f4cb04`

## Textures (hero.avatar.1030.v1 / hero.bust.1030.v1)

- `client/public/assets/art/v1/textures/1x/hero/avatar/1030.png` — 6619 bytes, sha256 `083297f8e73ecc33f2c05bd9cbbb1185a0bd790b6b574ac6786aa5d1ed2bbdb8`
- `client/public/assets/art/v1/textures/2x/hero/avatar/1030.png` — 21742 bytes, sha256 `178bd61a14ad7e1bdac282b9a14dd5bcd4d531895a922099f9002dce88b3a003`
- `client/public/assets/art/v1/textures/1x/hero/bust/1030.png` — 28208 bytes, sha256 `73a01ead4057d0cab92ea7736c32209c22b3f22c339582b9e385d7f20a84af8d`
- `client/public/assets/art/v1/textures/2x/hero/bust/1030.png` — 96935 bytes, sha256 `b464f392af50021fc1cd311cf0a24ba59676022dcdc403a2fde0d3dda79efdc5`

## Probe summary

```json
{
  "probes": {
    "1600x900-dpr1": {
      "ok": true,
      "template_cfg_id": 1030,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "夏侯渊",
      "listAvatarVisible": true,
      "listAvatarInClip": true,
      "listNameInClip": true,
      "listAvatarRoundMask": true,
      "listRowTemplateOk": true,
      "listAvatarFrameOk": true,
      "listRowPrimaryText": "夏侯渊 · Lv9 · 忠诚 80",
      "captureSectionsVisible": true,
      "dpr": 1,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1030.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1030.png",
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
        "top": 1604.046875,
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
      "template_cfg_id": 1030,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "夏侯渊",
      "listAvatarVisible": true,
      "listAvatarInClip": true,
      "listNameInClip": true,
      "listAvatarRoundMask": true,
      "listRowTemplateOk": true,
      "listAvatarFrameOk": true,
      "listRowPrimaryText": "夏侯渊 · Lv9 · 忠诚 80",
      "captureSectionsVisible": true,
      "dpr": 2,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "2",
        "srcTail": "2x/hero/avatar/1030.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "2",
        "srcTail": "2x/hero/bust/1030.png",
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
        "top": 1610.046875,
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
      "template_cfg_id": 1030,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "夏侯渊",
      "listAvatarVisible": true,
      "listAvatarInClip": false,
      "listNameInClip": false,
      "listAvatarRoundMask": true,
      "listRowTemplateOk": true,
      "listAvatarFrameOk": false,
      "listRowPrimaryText": "夏侯渊 · Lv9 · 忠诚 80",
      "captureSectionsVisible": true,
      "dpr": 1,
      "uiScale": 0.8,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1030.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1030.png",
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
      "text": "夏侯渊"
    },
    "viewport": {
      "w": 1280,
      "h": 720,
      "dpr": 1
    }
  }
}
```
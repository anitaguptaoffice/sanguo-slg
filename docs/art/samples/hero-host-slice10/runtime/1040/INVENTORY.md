# HERO-HOST-SLICE10 runtime inventory — template 1040

evidence_head_sha / tip_sha / runtime_code_sha: `41aa4898a3d050d80b12c2b9fe7e4d135e52bf44`
base_host_sha: `a23b7ade43cf0711ddc778f5589046a547c23a5d`
art_head_sha: `c62723ae2c9fd4b466b5a90036673f1d71a067ef`
hero_mail_panels_blob_sha: `356f8e33734ca1374f3cf1ecd61368431293a93c`
mock_server_blob_sha: `57afa95ef46e1b18af6f234be5c4908dc9a67c42`

## Viewport captures

- `runtime/1040/hero-host-1600x900-dpr1.jpg` — 1600×900 @ DPR 1, 463026 bytes, sha256 `4296821cbc927822b8323c5c2ce8f5d2ea55296f14b16b81c0e3d82bde4fe520`
- `runtime/1040/hero-host-1600x900-dpr2.jpg` — 1600×900 @ DPR 2, 970042 bytes, sha256 `831169c97c4ff4d0d8c1271ff5faf84832fda878db6f15b6d7b37fdc357772cd`
- `runtime/1040/hero-host-1280x720-dpr1.jpg` — 1280×720 @ DPR 1, 248540 bytes, sha256 `07172bc9c1eede95933905f03d220b641d0ecebc073c1ff66d16dafaecaabe84`
- `runtime/1040/hero-host-1280x720-dpr1-bust-name-sameframe.jpg` — 1280×720 bust+name same frame, sha256 `c2613f60b2ae42d02085961b5d39ff823b7dffa842f45e81e1f66943ab9e0b30`

## Textures (hero.avatar.1040.v1 / hero.bust.1040.v1)

- `client/public/assets/art/v1/textures/1x/hero/avatar/1040.png` — 6130 bytes, sha256 `24664e3fb219b9809985d97de10394fba8c2fb8e87c1eb32c2e55ddd73f71b33`
- `client/public/assets/art/v1/textures/2x/hero/avatar/1040.png` — 19475 bytes, sha256 `2379a735bba835d013e9f3d0e42acd8d1b9f78485ca99c9bec77ac4ce6f529da`
- `client/public/assets/art/v1/textures/1x/hero/bust/1040.png` — 29126 bytes, sha256 `5c1d25c703247fa0e238a579daf9d26f7779e55b173f1bfa9fb54e2996f8a038`
- `client/public/assets/art/v1/textures/2x/hero/bust/1040.png` — 98222 bytes, sha256 `283572bb51f82acc22a9d00bee4eb7146ed1156e9110e96427e41b790a8c3538`

## Probe summary

```json
{
  "probes": {
    "1600x900-dpr1": {
      "ok": true,
      "template_cfg_id": 1040,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "貂蝉",
      "listAvatarVisible": true,
      "listAvatarInClip": true,
      "listNameInClip": true,
      "listAvatarRoundMask": true,
      "listRowTemplateOk": true,
      "listAvatarFrameOk": true,
      "listRowPrimaryText": "貂蝉 · Lv12 · 忠诚 88",
      "captureSectionsVisible": true,
      "dpr": 1,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1040.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1040.png",
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
        "top": 3728.796875,
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
      "template_cfg_id": 1040,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "貂蝉",
      "listAvatarVisible": true,
      "listAvatarInClip": true,
      "listNameInClip": true,
      "listAvatarRoundMask": true,
      "listRowTemplateOk": true,
      "listAvatarFrameOk": true,
      "listRowPrimaryText": "貂蝉 · Lv12 · 忠诚 88",
      "captureSectionsVisible": true,
      "dpr": 2,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "2",
        "srcTail": "2x/hero/avatar/1040.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "2",
        "srcTail": "2x/hero/bust/1040.png",
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
        "top": 3734.796875,
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
      "template_cfg_id": 1040,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "貂蝉",
      "listAvatarVisible": true,
      "listAvatarInClip": false,
      "listNameInClip": false,
      "listAvatarRoundMask": true,
      "listRowTemplateOk": true,
      "listAvatarFrameOk": false,
      "listRowPrimaryText": "貂蝉 · Lv12 · 忠诚 88",
      "captureSectionsVisible": true,
      "dpr": 1,
      "uiScale": 0.8,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1040.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1040.png",
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
      "text": "貂蝉"
    },
    "viewport": {
      "w": 1280,
      "h": 720,
      "dpr": 1
    }
  }
}
```
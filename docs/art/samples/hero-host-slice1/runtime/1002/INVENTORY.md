# HERO-HOST-SLICE1 runtime inventory — template 1002

tip_sha / runtime_code_sha: `c520c83a751aa24065a90286632a32757e0fb7e7`
art_head_sha (Draft #1017): `d9d04ac15ded6e31c49139cb43afc28abe5a35b0`

## Viewport captures

- `runtime/1002/hero-host-1600x900-dpr1.jpg` — 1600×900 @ DPR 1, 471046 bytes, sha256 `e4142fd0f5d2cad39a45f35d8d18e1f094f774ba642a410b31148db3c54ab95a`
- `runtime/1002/hero-host-1600x900-dpr2.jpg` — 1600×900 @ DPR 2, 982148 bytes, sha256 `4f95459a4c795329392cf188b52271a2677bc7fe7e1bf6f0732ec5996bf23b4d`
- `runtime/1002/hero-host-1280x720-dpr1.jpg` — 1280×720 @ DPR 1, 256606 bytes, sha256 `d0eca06798a750294dec9d1f56024d1e3e632cfc793c7fe82c449e0092aab796`
- `runtime/1002/hero-host-1280x720-dpr1-bust-name-sameframe.jpg` — 1280×720 bust+name same frame, sha256 `191d39bd79ab666886ef46f3869ad95a6d36773bf9b1744ac6d772a5a409287d`

## Textures (hero.avatar.1002.v1 / hero.bust.1002.v1)

- `client/public/assets/art/v1/textures/1x/hero/avatar/1002.png` — 6064 bytes, sha256 `f0854499ba585f008a62883cf66024a449d8a0c24232091e06be53f4a20080c6`
- `client/public/assets/art/v1/textures/2x/hero/avatar/1002.png` — 21196 bytes, sha256 `c1d131660356a428d9ad1622dcb36bf6e6a7f401276e1b07965bb509dc0c19ee`
- `client/public/assets/art/v1/textures/1x/hero/bust/1002.png` — 30657 bytes, sha256 `12f71be71b87f9f82313e7b6949fe88731058152ed1f6ec47dadbcd802fdc0c8`
- `client/public/assets/art/v1/textures/2x/hero/bust/1002.png` — 104830 bytes, sha256 `4ad0273e1b0d260f6697968d2f84bea3c962d7eaeed65c6d86b813bb3f0a6ffd`

## Probe summary

```json
{
  "probes": {
    "1600x900-dpr1": {
      "ok": true,
      "template_cfg_id": 1002,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "关羽",
      "listAvatarVisible": true,
      "dpr": 1,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1002.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1002.png",
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
      "detailFooterVisible": true
    },
    "1600x900-dpr2": {
      "ok": true,
      "template_cfg_id": 1002,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "关羽",
      "listAvatarVisible": true,
      "dpr": 2,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "2",
        "srcTail": "2x/hero/avatar/1002.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "2",
        "srcTail": "2x/hero/bust/1002.png",
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
      "detailFooterVisible": true
    },
    "1280x720-dpr1": {
      "ok": true,
      "template_cfg_id": 1002,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "关羽",
      "listAvatarVisible": true,
      "dpr": 1,
      "uiScale": 0.8,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1002.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1002.png",
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
      "detailFooterVisible": true
    }
  },
  "sameframe": {
    "ok": true,
    "bustInViewport": true,
    "nameInViewport": true,
    "nameRightOfBust": true,
    "verticalBandOverlap": true,
    "gapPx": 10,
    "gapNear10px": true,
    "name": {
      "text": "关羽"
    },
    "viewport": {
      "w": 1280,
      "h": 720,
      "dpr": 1
    }
  }
}
```
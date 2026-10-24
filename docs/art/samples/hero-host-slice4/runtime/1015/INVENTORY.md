# HERO-HOST-SLICE4 runtime inventory — template 1015

tip_sha / runtime_code_sha: `3b9b7098d988483e3e507e0de5f1b5996255e1c8`
art_head_sha (Draft #1192): `cc9da5f28492bbbcb8d82d87458041d685726661`

## Viewport captures

- `runtime/1015/hero-host-1600x900-dpr1.jpg` — 1600×900 @ DPR 1, 473581 bytes, sha256 `954403881cc5982f78879376f2291faa74363d85250d251cb537faaa3bd529d6`
- `runtime/1015/hero-host-1600x900-dpr2.jpg` — 1600×900 @ DPR 2, 985480 bytes, sha256 `09e84975f122642c62771890cfa12566c83846968200202cfd051bdb49df6484`
- `runtime/1015/hero-host-1280x720-dpr1.jpg` — 1280×720 @ DPR 1, 259729 bytes, sha256 `2d0ffbd0776a7a4fc200bc71486eb7543970097da73289ab2f1abbea2a2ce243`
- `runtime/1015/hero-host-1280x720-dpr1-bust-name-sameframe.jpg` — 1280×720 bust+name same frame, sha256 `0bc633941b1fbd7d447eee82be5707063371df187cc57d82fbb89baf3fd9f272`

## Textures (hero.avatar.1015.v1 / hero.bust.1015.v1)

- `client/public/assets/art/v1/textures/1x/hero/avatar/1015.png` — 6449 bytes, sha256 `496d47944354604997095ed1b28d4fad5d7ae15edf3b56b713205afa4b6715f5`
- `client/public/assets/art/v1/textures/2x/hero/avatar/1015.png` — 21016 bytes, sha256 `1086a014fef3a393ce051064bfe93c0973755613bbb1b2dcd84e2a0e24d70af2`
- `client/public/assets/art/v1/textures/1x/hero/bust/1015.png` — 28076 bytes, sha256 `46f4eea61d27e5c9dfc59a5177ba4b5768d4ec53d6051956847a4cbd71337370`
- `client/public/assets/art/v1/textures/2x/hero/bust/1015.png` — 97482 bytes, sha256 `ad4a6128cde8988abc9e61dee4d9daaf4ef8b6a43617c49554c2c7d66a4cafe5`

## Probe summary

```json
{
  "probes": {
    "1600x900-dpr1": {
      "ok": true,
      "template_cfg_id": 1015,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "曹仁",
      "listAvatarVisible": true,
      "dpr": 1,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1015.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1015.png",
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
      "template_cfg_id": 1015,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "曹仁",
      "listAvatarVisible": true,
      "dpr": 2,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "2",
        "srcTail": "2x/hero/avatar/1015.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "2",
        "srcTail": "2x/hero/bust/1015.png",
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
      "template_cfg_id": 1015,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "曹仁",
      "listAvatarVisible": true,
      "dpr": 1,
      "uiScale": 0.8,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1015.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1015.png",
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
      "text": "曹仁"
    },
    "viewport": {
      "w": 1280,
      "h": 720,
      "dpr": 1
    }
  }
}
```
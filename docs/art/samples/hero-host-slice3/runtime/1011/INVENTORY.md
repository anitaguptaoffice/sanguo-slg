# HERO-HOST-SLICE3 runtime inventory — template 1011

tip_sha / runtime_code_sha: `3b9b7098d988483e3e507e0de5f1b5996255e1c8`
art_head_sha (Draft #1191): `320955f1ff4565b161268640226bf3d4156d4f17`

## Viewport captures

- `runtime/1011/hero-host-1600x900-dpr1.jpg` — 1600×900 @ DPR 1, 475329 bytes, sha256 `b0d37c1e10badfffba1c66a0394c944ad68f21f37e67e2a64c6254ff3505cdaa`
- `runtime/1011/hero-host-1600x900-dpr2.jpg` — 1600×900 @ DPR 2, 992424 bytes, sha256 `1a570c1683fccfd80bf1ad0bb70348304902b6bd6dc923b2f147837d864e72ad`
- `runtime/1011/hero-host-1280x720-dpr1.jpg` — 1280×720 @ DPR 1, 259008 bytes, sha256 `b4425c7ad01bcd91cf42d4f8ac673794aa782e65fd92c0f69be0ea94ab10b2a9`
- `runtime/1011/hero-host-1280x720-dpr1-bust-name-sameframe.jpg` — 1280×720 bust+name same frame, sha256 `9d88ce388b398263015b282c864467b4b5f0e0b6b4dce737372591ddcc579fb3`

## Textures (hero.avatar.1011.v1 / hero.bust.1011.v1)

- `client/public/assets/art/v1/textures/1x/hero/avatar/1011.png` — 6772 bytes, sha256 `34afd332b3022fe7abbceeb1319aad8b1b3ea156c5e1dcfc9fa0ef3d72971609`
- `client/public/assets/art/v1/textures/2x/hero/avatar/1011.png` — 22025 bytes, sha256 `7cd5db619d368dbd1c5b751262ad6ec201c431b1137027032e7487844c2e99b6`
- `client/public/assets/art/v1/textures/1x/hero/bust/1011.png` — 29482 bytes, sha256 `5ee1373f98fcdeb7c76835ce7243ffd9fe144839309613a9f173193edeebc3a2`
- `client/public/assets/art/v1/textures/2x/hero/bust/1011.png` — 102613 bytes, sha256 `ae4c5018225feebf7be91db96c7cd1b18b9573cc235eee23d14a275d5ce50b4b`

## Probe summary

```json
{
  "probes": {
    "1600x900-dpr1": {
      "ok": true,
      "template_cfg_id": 1011,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "吕布",
      "listAvatarVisible": true,
      "dpr": 1,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1011.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1011.png",
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
      "template_cfg_id": 1011,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "吕布",
      "listAvatarVisible": true,
      "dpr": 2,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "2",
        "srcTail": "2x/hero/avatar/1011.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "2",
        "srcTail": "2x/hero/bust/1011.png",
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
      "template_cfg_id": 1011,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "吕布",
      "listAvatarVisible": true,
      "dpr": 1,
      "uiScale": 0.8,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1011.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1011.png",
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
      "text": "吕布"
    },
    "viewport": {
      "w": 1280,
      "h": 720,
      "dpr": 1
    }
  }
}
```
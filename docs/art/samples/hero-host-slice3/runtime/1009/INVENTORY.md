# HERO-HOST-SLICE3 runtime inventory — template 1009

tip_sha / runtime_code_sha: `3b9b7098d988483e3e507e0de5f1b5996255e1c8`
art_head_sha (Draft #1191): `320955f1ff4565b161268640226bf3d4156d4f17`

## Viewport captures

- `runtime/1009/hero-host-1600x900-dpr1.jpg` — 1600×900 @ DPR 1, 471502 bytes, sha256 `9666eb3daf28f2094ee26168678c45d4da2b7d61382fa87318b37dfe507c39be`
- `runtime/1009/hero-host-1600x900-dpr2.jpg` — 1600×900 @ DPR 2, 986889 bytes, sha256 `fbafeaa5aa96d71eecb90c78b04a070e5fe19b7c0d5af529e9c4916af021a4c1`
- `runtime/1009/hero-host-1280x720-dpr1.jpg` — 1280×720 @ DPR 1, 259008 bytes, sha256 `b4425c7ad01bcd91cf42d4f8ac673794aa782e65fd92c0f69be0ea94ab10b2a9`
- `runtime/1009/hero-host-1280x720-dpr1-bust-name-sameframe.jpg` — 1280×720 bust+name same frame, sha256 `6324a99393ea2a79495f39d109720e0702d7fa5b23e7cca05c2abae8306089e3`

## Textures (hero.avatar.1009.v1 / hero.bust.1009.v1)

- `client/public/assets/art/v1/textures/1x/hero/avatar/1009.png` — 6056 bytes, sha256 `77f4df0b11c6b07e8ede70145ff7eeba9d2661d1a07133309f91c9195efb183e`
- `client/public/assets/art/v1/textures/2x/hero/avatar/1009.png` — 20022 bytes, sha256 `e9ea43dad0d70b95020b46c2a75093affad4b03287a876c99fcca34b43e84c39`
- `client/public/assets/art/v1/textures/1x/hero/bust/1009.png` — 29833 bytes, sha256 `ac7b052c06a262776e2529241af70dfaac279b49c272d0e26cd4a2596fa3d769`
- `client/public/assets/art/v1/textures/2x/hero/bust/1009.png` — 102719 bytes, sha256 `4cddfd837dd52e70a9f1fc21198668e5b3a60b8b570adb459e5189d10d744034`

## Probe summary

```json
{
  "probes": {
    "1600x900-dpr1": {
      "ok": true,
      "template_cfg_id": 1009,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "曹操",
      "listAvatarVisible": true,
      "dpr": 1,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1009.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1009.png",
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
      "template_cfg_id": 1009,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "曹操",
      "listAvatarVisible": true,
      "dpr": 2,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "2",
        "srcTail": "2x/hero/avatar/1009.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "2",
        "srcTail": "2x/hero/bust/1009.png",
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
      "template_cfg_id": 1009,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "曹操",
      "listAvatarVisible": true,
      "dpr": 1,
      "uiScale": 0.8,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1009.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1009.png",
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
      "text": "曹操"
    },
    "viewport": {
      "w": 1280,
      "h": 720,
      "dpr": 1
    }
  }
}
```
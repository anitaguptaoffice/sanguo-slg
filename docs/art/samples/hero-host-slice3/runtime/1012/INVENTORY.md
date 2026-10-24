# HERO-HOST-SLICE3 runtime inventory — template 1012

tip_sha / runtime_code_sha: `3b9b7098d988483e3e507e0de5f1b5996255e1c8`
art_head_sha (Draft #1191): `320955f1ff4565b161268640226bf3d4156d4f17`

## Viewport captures

- `runtime/1012/hero-host-1600x900-dpr1.jpg` — 1600×900 @ DPR 1, 471873 bytes, sha256 `e4cbaa577493107c2f33bc97276d9ab0b98b3f9eb4581fb4ff0e521152519778`
- `runtime/1012/hero-host-1600x900-dpr2.jpg` — 1600×900 @ DPR 2, 986649 bytes, sha256 `d3f6ba4d8f0d2591ec36c2622978f947ca422bc07b645650114650354b1c6802`
- `runtime/1012/hero-host-1280x720-dpr1.jpg` — 1280×720 @ DPR 1, 259008 bytes, sha256 `b4425c7ad01bcd91cf42d4f8ac673794aa782e65fd92c0f69be0ea94ab10b2a9`
- `runtime/1012/hero-host-1280x720-dpr1-bust-name-sameframe.jpg` — 1280×720 bust+name same frame, sha256 `03b0f379225595feb17453fa1bec2e22893925461177e27d1aa8b6b5daca00dc`

## Textures (hero.avatar.1012.v1 / hero.bust.1012.v1)

- `client/public/assets/art/v1/textures/1x/hero/avatar/1012.png` — 5635 bytes, sha256 `9ce7a5eb42dde36a2a093b4d9263fdde38a0b42611d8b8d2554f6d83770f3016`
- `client/public/assets/art/v1/textures/2x/hero/avatar/1012.png` — 18669 bytes, sha256 `0d31448a4b228c8d163a982a1e102dc3258773f4ac585ca5216733695d0318d6`
- `client/public/assets/art/v1/textures/1x/hero/bust/1012.png` — 29979 bytes, sha256 `2a2b771e408b5b7f482cacec7a0f9947399f833e7a393ca11ff2793d258af3d0`
- `client/public/assets/art/v1/textures/2x/hero/bust/1012.png` — 101113 bytes, sha256 `c8d57f4c08866fa634983a99227a12b3a30cba35eb8f6f8992dd2fa4c937e73a`

## Probe summary

```json
{
  "probes": {
    "1600x900-dpr1": {
      "ok": true,
      "template_cfg_id": 1012,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "司马懿",
      "listAvatarVisible": true,
      "dpr": 1,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1012.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1012.png",
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
      "template_cfg_id": 1012,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "司马懿",
      "listAvatarVisible": true,
      "dpr": 2,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "2",
        "srcTail": "2x/hero/avatar/1012.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "2",
        "srcTail": "2x/hero/bust/1012.png",
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
      "template_cfg_id": 1012,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "司马懿",
      "listAvatarVisible": true,
      "dpr": 1,
      "uiScale": 0.8,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1012.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1012.png",
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
      "text": "司马懿"
    },
    "viewport": {
      "w": 1280,
      "h": 720,
      "dpr": 1
    }
  }
}
```
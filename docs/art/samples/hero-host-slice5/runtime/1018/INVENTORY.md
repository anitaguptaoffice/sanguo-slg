# HERO-HOST-SLICE5 runtime inventory — template 1018

tip_sha / runtime_code_sha: `3b9b7098d988483e3e507e0de5f1b5996255e1c8`
art_head_sha (Draft #1193): `9f15a34119c1bcb157399693a5420c0a2787a47a`

## Viewport captures

- `runtime/1018/hero-host-1600x900-dpr1.jpg` — 1600×900 @ DPR 1, 470960 bytes, sha256 `a9cd1592cd11fe528ac40b4fdf78537fddcd202d61d21b258cc3e9c0029a40a4`
- `runtime/1018/hero-host-1600x900-dpr2.jpg` — 1600×900 @ DPR 2, 985894 bytes, sha256 `b18e7932bd1c7a1ee0582d59e7eb0e685f52417c53040a594645371085180feb`
- `runtime/1018/hero-host-1280x720-dpr1.jpg` — 1280×720 @ DPR 1, 259008 bytes, sha256 `b4425c7ad01bcd91cf42d4f8ac673794aa782e65fd92c0f69be0ea94ab10b2a9`
- `runtime/1018/hero-host-1280x720-dpr1-bust-name-sameframe.jpg` — 1280×720 bust+name same frame, sha256 `095c1ffb61a1310d89f0fa7c3eb18dd96da99750b57175573ca17f0b66fb4765`

## Textures (hero.avatar.1018.v1 / hero.bust.1018.v1)

- `client/public/assets/art/v1/textures/1x/hero/avatar/1018.png` — 5885 bytes, sha256 `6b0f9b75b797b2f974546df16bb63765182b03946048c42f8f6b09d3525bd270`
- `client/public/assets/art/v1/textures/2x/hero/avatar/1018.png` — 18901 bytes, sha256 `de6847df35523a33988438e57c9f4ded2527c41e583b6345d05ef53db2c2631b`
- `client/public/assets/art/v1/textures/1x/hero/bust/1018.png` — 29655 bytes, sha256 `a813125548899c6397c542a7bef0fec247a2d2fd30fdd2ae1345f0f76fced5f8`
- `client/public/assets/art/v1/textures/2x/hero/bust/1018.png` — 99045 bytes, sha256 `541ee195e5333443955d2a488b616d5a029b73378d4e6ba9bf5c3d1170b01c68`

## Probe summary

```json
{
  "probes": {
    "1600x900-dpr1": {
      "ok": true,
      "template_cfg_id": 1018,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "荀彧",
      "listAvatarVisible": true,
      "dpr": 1,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1018.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1018.png",
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
      "template_cfg_id": 1018,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "荀彧",
      "listAvatarVisible": true,
      "dpr": 2,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "2",
        "srcTail": "2x/hero/avatar/1018.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "2",
        "srcTail": "2x/hero/bust/1018.png",
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
      "template_cfg_id": 1018,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "荀彧",
      "listAvatarVisible": true,
      "dpr": 1,
      "uiScale": 0.8,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1018.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1018.png",
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
      "text": "荀彧"
    },
    "viewport": {
      "w": 1280,
      "h": 720,
      "dpr": 1
    }
  }
}
```
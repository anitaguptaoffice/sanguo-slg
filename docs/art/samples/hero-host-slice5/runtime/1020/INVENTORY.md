# HERO-HOST-SLICE5 runtime inventory — template 1020

tip_sha / runtime_code_sha: `3b9b7098d988483e3e507e0de5f1b5996255e1c8`
art_head_sha (Draft #1193): `9f15a34119c1bcb157399693a5420c0a2787a47a`

## Viewport captures

- `runtime/1020/hero-host-1600x900-dpr1.jpg` — 1600×900 @ DPR 1, 471581 bytes, sha256 `12252992cfda4c86aa947c12d97d0a294fa7b6db2ec3c7e93c7ce18aa6bfdc3f`
- `runtime/1020/hero-host-1600x900-dpr2.jpg` — 1600×900 @ DPR 2, 986922 bytes, sha256 `f28950bc56497fb50315bcf85bfb8ff18759ae1343466ad3562be528f4092a7a`
- `runtime/1020/hero-host-1280x720-dpr1.jpg` — 1280×720 @ DPR 1, 259008 bytes, sha256 `b4425c7ad01bcd91cf42d4f8ac673794aa782e65fd92c0f69be0ea94ab10b2a9`
- `runtime/1020/hero-host-1280x720-dpr1-bust-name-sameframe.jpg` — 1280×720 bust+name same frame, sha256 `ddbffe3af18523272b4a7b2be7cb4c5f2a0bdc00739c42ed8cc757bd76f7d1e5`

## Textures (hero.avatar.1020.v1 / hero.bust.1020.v1)

- `client/public/assets/art/v1/textures/1x/hero/avatar/1020.png` — 6232 bytes, sha256 `81220c35737b331cadf465244cd184ec067f47677661817ed6644a3c6e339f5d`
- `client/public/assets/art/v1/textures/2x/hero/avatar/1020.png` — 20547 bytes, sha256 `c395b169975bc31879ad9112eab6c035ef1b97a38eae4d52e73390b4dcc038e6`
- `client/public/assets/art/v1/textures/1x/hero/bust/1020.png` — 31158 bytes, sha256 `0e344a856895d205ef8a67e341441c791923a11c91a7c70652dd669dde4bc1cf`
- `client/public/assets/art/v1/textures/2x/hero/bust/1020.png` — 108738 bytes, sha256 `d66d5425229f4500d91d9445f5cc3cd38f9cab93c10334f02259f194d1ab2fd5`

## Probe summary

```json
{
  "probes": {
    "1600x900-dpr1": {
      "ok": true,
      "template_cfg_id": 1020,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "甘宁",
      "listAvatarVisible": true,
      "dpr": 1,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1020.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1020.png",
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
      "template_cfg_id": 1020,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "甘宁",
      "listAvatarVisible": true,
      "dpr": 2,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "2",
        "srcTail": "2x/hero/avatar/1020.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "2",
        "srcTail": "2x/hero/bust/1020.png",
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
      "template_cfg_id": 1020,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "甘宁",
      "listAvatarVisible": true,
      "dpr": 1,
      "uiScale": 0.8,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1020.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1020.png",
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
      "text": "甘宁"
    },
    "viewport": {
      "w": 1280,
      "h": 720,
      "dpr": 1
    }
  }
}
```
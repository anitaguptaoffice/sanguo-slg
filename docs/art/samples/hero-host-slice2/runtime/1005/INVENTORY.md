# HERO-HOST-SLICE2 runtime inventory — template 1005

tip_sha / runtime_code_sha: `0e96842e67ea10e549db52fa427c6236e9072dcf`
art_head_sha (Draft #1069): `4af5abdccf9f882db0123ffb37753c24322be90e`

## Viewport captures

- `runtime/1005/hero-host-1600x900-dpr1.jpg` — 1600×900 @ DPR 1, 473929 bytes, sha256 `0c83da79c21cec61eef1e7290a31064a83f25f5e02f76b6ec970631abf81be78`
- `runtime/1005/hero-host-1600x900-dpr2.jpg` — 1600×900 @ DPR 2, 990952 bytes, sha256 `aa45474339a37b6401764bde90f5f9d6f829cdd2bec1b94ee07a606e93a96c19`
- `runtime/1005/hero-host-1280x720-dpr1.jpg` — 1280×720 @ DPR 1, 257221 bytes, sha256 `6a0ad02c0ab0f2fbee8c866135949025829f49d3eb0e4d87582ff8279e8c75c1`
- `runtime/1005/hero-host-1280x720-dpr1-bust-name-sameframe.jpg` — 1280×720 bust+name same frame, sha256 `48b62c491fc89ea8e7175ffe87bce96e15c9a11bce505e1912313fc7cd74bb35`

## Textures (hero.avatar.1005.v1 / hero.bust.1005.v1)

- `client/public/assets/art/v1/textures/1x/hero/avatar/1005.png` — 6072 bytes, sha256 `829790c1e20393e309e073c0bb4834670b836d04c098028be2098bb5d2a1f67c`
- `client/public/assets/art/v1/textures/2x/hero/avatar/1005.png` — 20472 bytes, sha256 `ed6a8a4d502aae66ab13b239ec0cc495c9d1a675217750046d9d30d89192021a`
- `client/public/assets/art/v1/textures/1x/hero/bust/1005.png` — 30130 bytes, sha256 `10bd51840e8268fdf3e0656906c1a9439f73c4210e28ff33fd29d6df18f6026a`
- `client/public/assets/art/v1/textures/2x/hero/bust/1005.png` — 103482 bytes, sha256 `293a58d218addbc5dc66e207309363ca587f6647b69371e706788894cf8b82cb`

## Probe summary

```json
{
  "probes": {
    "1600x900-dpr1": {
      "ok": true,
      "template_cfg_id": 1005,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "黄忠",
      "listAvatarVisible": true,
      "dpr": 1,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1005.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1005.png",
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
      "template_cfg_id": 1005,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "黄忠",
      "listAvatarVisible": true,
      "dpr": 2,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "2",
        "srcTail": "2x/hero/avatar/1005.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "2",
        "srcTail": "2x/hero/bust/1005.png",
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
      "template_cfg_id": 1005,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "黄忠",
      "listAvatarVisible": true,
      "dpr": 1,
      "uiScale": 0.8,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1005.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1005.png",
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
      "text": "黄忠"
    },
    "viewport": {
      "w": 1280,
      "h": 720,
      "dpr": 1
    }
  }
}
```
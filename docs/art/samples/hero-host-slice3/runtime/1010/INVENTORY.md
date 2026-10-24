# HERO-HOST-SLICE3 runtime inventory — template 1010

tip_sha / runtime_code_sha: `d53add74b9aafc5762ff818d6e14aab3f613e840`
art_head_sha (Draft #1191): `320955f1ff4565b161268640226bf3d4156d4f17`

## Viewport captures

- `runtime/1010/hero-host-1600x900-dpr1.jpg` — 1600×900 @ DPR 1, 471272 bytes, sha256 `a97eb1fa30c521ef8a2ad1dd08008169c11887d2df4c4a67de23b9f7bf762aed`
- `runtime/1010/hero-host-1600x900-dpr2.jpg` — 1600×900 @ DPR 2, 986003 bytes, sha256 `38d697107f48adbb84b4cb627e76222e7caca8ce00bf1bc7b8dcc2da7faf2675`
- `runtime/1010/hero-host-1280x720-dpr1.jpg` — 1280×720 @ DPR 1, 259008 bytes, sha256 `b4425c7ad01bcd91cf42d4f8ac673794aa782e65fd92c0f69be0ea94ab10b2a9`
- `runtime/1010/hero-host-1280x720-dpr1-bust-name-sameframe.jpg` — 1280×720 bust+name same frame, sha256 `e57d29ebdc39c4100f2c8360b7c687357f0cf54e65f287df64d6caae41574ec8`

## Textures (hero.avatar.1010.v1 / hero.bust.1010.v1)

- `client/public/assets/art/v1/textures/1x/hero/avatar/1010.png` — 6251 bytes, sha256 `b0b6ca790458b88f211b76b37c71fe21e20c2c06002cdfefc0b64808af10bca1`
- `client/public/assets/art/v1/textures/2x/hero/avatar/1010.png` — 20317 bytes, sha256 `34e674276c78a9b14b0c3711c5be9c4d87ad8a866643d35fad66d3ab432b538a`
- `client/public/assets/art/v1/textures/1x/hero/bust/1010.png` — 30398 bytes, sha256 `52c36f2e74a30af338cd52df73e103344ed861541731ace226e52ae969e57217`
- `client/public/assets/art/v1/textures/2x/hero/bust/1010.png` — 103830 bytes, sha256 `0e270dbf99ba19dd3937ea2861182e568157771c5aaad80d88313b5c586a87b7`

## Probe summary

```json
{
  "probes": {
    "1600x900-dpr1": {
      "ok": true,
      "template_cfg_id": 1010,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "孙权",
      "listAvatarVisible": true,
      "dpr": 1,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1010.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1010.png",
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
      "template_cfg_id": 1010,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "孙权",
      "listAvatarVisible": true,
      "dpr": 2,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "2",
        "srcTail": "2x/hero/avatar/1010.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "2",
        "srcTail": "2x/hero/bust/1010.png",
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
      "template_cfg_id": 1010,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "孙权",
      "listAvatarVisible": true,
      "dpr": 1,
      "uiScale": 0.8,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1010.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1010.png",
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
      "text": "孙权"
    },
    "viewport": {
      "w": 1280,
      "h": 720,
      "dpr": 1
    }
  }
}
```
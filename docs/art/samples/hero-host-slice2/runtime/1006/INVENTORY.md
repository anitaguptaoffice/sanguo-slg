# HERO-HOST-SLICE2 runtime inventory — template 1006

tip_sha / runtime_code_sha: `0e96842e67ea10e549db52fa427c6236e9072dcf`
art_head_sha (Draft #1069): `4af5abdccf9f882db0123ffb37753c24322be90e`

## Viewport captures

- `runtime/1006/hero-host-1600x900-dpr1.jpg` — 1600×900 @ DPR 1, 473543 bytes, sha256 `388e1bf81b8d33348f0eae52c10f5ad8a79fe487d67d581f335675af3f96fe7b`
- `runtime/1006/hero-host-1600x900-dpr2.jpg` — 1600×900 @ DPR 2, 990951 bytes, sha256 `cba8233ecc6937346c4de96de02c13e846f60b31cde27800e227af4a290d8d80`
- `runtime/1006/hero-host-1280x720-dpr1.jpg` — 1280×720 @ DPR 1, 257221 bytes, sha256 `6a0ad02c0ab0f2fbee8c866135949025829f49d3eb0e4d87582ff8279e8c75c1`
- `runtime/1006/hero-host-1280x720-dpr1-bust-name-sameframe.jpg` — 1280×720 bust+name same frame, sha256 `3bf6b1efb87396aec528520845c3389213182e7531ccd22f39f0a0ed0b12e671`

## Textures (hero.avatar.1006.v1 / hero.bust.1006.v1)

- `client/public/assets/art/v1/textures/1x/hero/avatar/1006.png` — 6260 bytes, sha256 `eabc50749f13622c69122e7a3340d57928a4ee346480c330dc5bad7bdc295a35`
- `client/public/assets/art/v1/textures/2x/hero/avatar/1006.png` — 20244 bytes, sha256 `f3434dc2a459968f6eb1993468632bfeafaa3105d6f0b96512cbf428e74390fa`
- `client/public/assets/art/v1/textures/1x/hero/bust/1006.png` — 30482 bytes, sha256 `19ec348e75ffd5365e4aca5cbebe67c327f084d39ac81b517213494db7e836ca`
- `client/public/assets/art/v1/textures/2x/hero/bust/1006.png` — 105536 bytes, sha256 `c79a021def9795a6346f4e8be45d1db5dbd81590611923ee9517784745aa4157`

## Probe summary

```json
{
  "probes": {
    "1600x900-dpr1": {
      "ok": true,
      "template_cfg_id": 1006,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "马超",
      "listAvatarVisible": true,
      "dpr": 1,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1006.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1006.png",
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
      "template_cfg_id": 1006,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "马超",
      "listAvatarVisible": true,
      "dpr": 2,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "2",
        "srcTail": "2x/hero/avatar/1006.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "2",
        "srcTail": "2x/hero/bust/1006.png",
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
      "template_cfg_id": 1006,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "马超",
      "listAvatarVisible": true,
      "dpr": 1,
      "uiScale": 0.8,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1006.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1006.png",
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
      "text": "马超"
    },
    "viewport": {
      "w": 1280,
      "h": 720,
      "dpr": 1
    }
  }
}
```
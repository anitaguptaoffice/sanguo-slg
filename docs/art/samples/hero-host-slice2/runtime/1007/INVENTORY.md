# HERO-HOST-SLICE2 runtime inventory — template 1007

tip_sha / runtime_code_sha: `099dccba34390fed4556cb3555301403db65478b`
art_head_sha (Draft #1069): `4af5abdccf9f882db0123ffb37753c24322be90e`

## Viewport captures

- `runtime/1007/hero-host-1600x900-dpr1.jpg` — 1600×900 @ DPR 1, 473382 bytes, sha256 `52d34806c339b491ebcb3419809a9ad5308ac8fdde31bd6897046dd597fe8265`
- `runtime/1007/hero-host-1600x900-dpr2.jpg` — 1600×900 @ DPR 2, 989161 bytes, sha256 `89dd4d28b2bd30ffc90831646adbed4e343e2fb25d2621e45bb19503c205bce3`
- `runtime/1007/hero-host-1280x720-dpr1.jpg` — 1280×720 @ DPR 1, 257221 bytes, sha256 `6a0ad02c0ab0f2fbee8c866135949025829f49d3eb0e4d87582ff8279e8c75c1`
- `runtime/1007/hero-host-1280x720-dpr1-bust-name-sameframe.jpg` — 1280×720 bust+name same frame, sha256 `70d6b98a55e396c37b1c4c95b1953dc692bd48c4ec6cc80d0b8efb2c300e7058`

## Textures (hero.avatar.1007.v1 / hero.bust.1007.v1)

- `client/public/assets/art/v1/textures/1x/hero/avatar/1007.png` — 5995 bytes, sha256 `3ed2ba5494a3fbf73397a2d4b19ce744b42cc561be3e9e0b52229fa7f24a06cc`
- `client/public/assets/art/v1/textures/2x/hero/avatar/1007.png` — 19511 bytes, sha256 `c772f74ddb8a8601f705ae3726bb39a4cba798264ef8f4f14440170b7d6276fb`
- `client/public/assets/art/v1/textures/1x/hero/bust/1007.png` — 27156 bytes, sha256 `d40975bdd3983340f975eb9f14383f08bfc607f12db480cbbc3a6db6da12af61`
- `client/public/assets/art/v1/textures/2x/hero/bust/1007.png` — 89403 bytes, sha256 `5da678830683ad06521c784f46662d90f113bfc319ddcb3ea9198c065b386847`

## Probe summary

```json
{
  "probes": {
    "1600x900-dpr1": {
      "ok": true,
      "template_cfg_id": 1007,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "诸葛亮",
      "listAvatarVisible": true,
      "dpr": 1,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1007.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1007.png",
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
      "template_cfg_id": 1007,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "诸葛亮",
      "listAvatarVisible": true,
      "dpr": 2,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "2",
        "srcTail": "2x/hero/avatar/1007.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "2",
        "srcTail": "2x/hero/bust/1007.png",
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
      "template_cfg_id": 1007,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "诸葛亮",
      "listAvatarVisible": true,
      "dpr": 1,
      "uiScale": 0.8,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1007.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1007.png",
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
      "text": "诸葛亮"
    },
    "viewport": {
      "w": 1280,
      "h": 720,
      "dpr": 1
    }
  }
}
```
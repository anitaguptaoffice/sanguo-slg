# HERO-HOST-SLICE1 runtime inventory — template 1004

tip_sha / runtime_code_sha: `c520c83a751aa24065a90286632a32757e0fb7e7`
art_head_sha (Draft #1017): `d9d04ac15ded6e31c49139cb43afc28abe5a35b0`

## Viewport captures

- `runtime/1004/hero-host-1600x900-dpr1.jpg` — 1600×900 @ DPR 1, 471969 bytes, sha256 `d6b285cfa74b62b7a7157a23969710048fe428e00755f0cd52a85b222b2ac740`
- `runtime/1004/hero-host-1600x900-dpr2.jpg` — 1600×900 @ DPR 2, 984666 bytes, sha256 `93c5ae53b781d443dff0a011653a65c3e4fe9fb83fcf3e76a5dd1e59e2117226`
- `runtime/1004/hero-host-1280x720-dpr1.jpg` — 1280×720 @ DPR 1, 257221 bytes, sha256 `6a0ad02c0ab0f2fbee8c866135949025829f49d3eb0e4d87582ff8279e8c75c1`
- `runtime/1004/hero-host-1280x720-dpr1-bust-name-sameframe.jpg` — 1280×720 bust+name same frame, sha256 `5672609ba261a563de9e58f37e9bc5e438cab7239be260cdba387f010cfd4257`

## Textures (hero.avatar.1004.v1 / hero.bust.1004.v1)

- `client/public/assets/art/v1/textures/1x/hero/avatar/1004.png` — 6351 bytes, sha256 `6bb1d51f9ffebefd8732727ae1b61ccff2dc41f6528a655058350abe47eec32f`
- `client/public/assets/art/v1/textures/2x/hero/avatar/1004.png` — 20151 bytes, sha256 `1dbfe487dff72e92942971f015157f52fe8df9065c6ad5dcfa2f49b2a6b598ba`
- `client/public/assets/art/v1/textures/1x/hero/bust/1004.png` — 32111 bytes, sha256 `37958428cbc5ac4326a3da88c55857a7c2a8480bb2a2cc0ac90bb1081877ccb4`
- `client/public/assets/art/v1/textures/2x/hero/bust/1004.png` — 110839 bytes, sha256 `06b642c68bdec15f8bdde5c0c40a072db01149098311f2a505fb2ce95820d7c8`

## Probe summary

```json
{
  "probes": {
    "1600x900-dpr1": {
      "ok": true,
      "template_cfg_id": 1004,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "赵云",
      "listAvatarVisible": true,
      "dpr": 1,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1004.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1004.png",
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
      "template_cfg_id": 1004,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "赵云",
      "listAvatarVisible": true,
      "dpr": 2,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "2",
        "srcTail": "2x/hero/avatar/1004.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "2",
        "srcTail": "2x/hero/bust/1004.png",
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
      "template_cfg_id": 1004,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "赵云",
      "listAvatarVisible": true,
      "dpr": 1,
      "uiScale": 0.8,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1004.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1004.png",
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
      "text": "赵云"
    },
    "viewport": {
      "w": 1280,
      "h": 720,
      "dpr": 1
    }
  }
}
```
# HERO-HOST-SLICE4 runtime inventory — template 1013

tip_sha / runtime_code_sha: `3b9b7098d988483e3e507e0de5f1b5996255e1c8`
art_head_sha (Draft #1192): `cc9da5f28492bbbcb8d82d87458041d685726661`

## Viewport captures

- `runtime/1013/hero-host-1600x900-dpr1.jpg` — 1600×900 @ DPR 1, 473277 bytes, sha256 `35f6414d3bc413ba4ddd3ef7751650754f143aeab2539e34307fb82df167a564`
- `runtime/1013/hero-host-1600x900-dpr2.jpg` — 1600×900 @ DPR 2, 988063 bytes, sha256 `6b516a263e5cd187f9fb7f0d2b9421ce1c8dc1d130bc23be45512a61726a56cd`
- `runtime/1013/hero-host-1280x720-dpr1.jpg` — 1280×720 @ DPR 1, 259729 bytes, sha256 `2d0ffbd0776a7a4fc200bc71486eb7543970097da73289ab2f1abbea2a2ce243`
- `runtime/1013/hero-host-1280x720-dpr1-bust-name-sameframe.jpg` — 1280×720 bust+name same frame, sha256 `b840c92ef01816b0e9a9ff21ed457039dbba3676706a882040a67fba40bf0bcd`

## Textures (hero.avatar.1013.v1 / hero.bust.1013.v1)

- `client/public/assets/art/v1/textures/1x/hero/avatar/1013.png` — 5933 bytes, sha256 `f32fb548d860a20c0bd43e915bc3a5467f91c0443ca104727f8f9391f50d9daa`
- `client/public/assets/art/v1/textures/2x/hero/avatar/1013.png` — 19307 bytes, sha256 `d1dab7b1098f3902516f9e70fd7d917fe5f2068633ed080fbbb361262fad9db2`
- `client/public/assets/art/v1/textures/1x/hero/bust/1013.png` — 28642 bytes, sha256 `8c95c892da353e3cf8a875657f16ecf79e49c0bc0518c55d9e6fb790b2ea06e8`
- `client/public/assets/art/v1/textures/2x/hero/bust/1013.png` — 98721 bytes, sha256 `604d27123ce49caf3f7c3b849d04ed20949484da7b4063f2462b3c683e7a66ad`

## Probe summary

```json
{
  "probes": {
    "1600x900-dpr1": {
      "ok": true,
      "template_cfg_id": 1013,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "张辽",
      "listAvatarVisible": true,
      "dpr": 1,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1013.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1013.png",
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
      "template_cfg_id": 1013,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "张辽",
      "listAvatarVisible": true,
      "dpr": 2,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "2",
        "srcTail": "2x/hero/avatar/1013.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "2",
        "srcTail": "2x/hero/bust/1013.png",
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
      "template_cfg_id": 1013,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "张辽",
      "listAvatarVisible": true,
      "dpr": 1,
      "uiScale": 0.8,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1013.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1013.png",
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
      "text": "张辽"
    },
    "viewport": {
      "w": 1280,
      "h": 720,
      "dpr": 1
    }
  }
}
```
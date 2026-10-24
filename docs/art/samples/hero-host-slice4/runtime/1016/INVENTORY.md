# HERO-HOST-SLICE4 runtime inventory — template 1016

tip_sha / runtime_code_sha: `3b9b7098d988483e3e507e0de5f1b5996255e1c8`
art_head_sha (Draft #1192): `cc9da5f28492bbbcb8d82d87458041d685726661`

## Viewport captures

- `runtime/1016/hero-host-1600x900-dpr1.jpg` — 1600×900 @ DPR 1, 475276 bytes, sha256 `5d2d686c93de58bcab4428bcd2535c38e3b149f5f91e8f3ed374e13662e6e099`
- `runtime/1016/hero-host-1600x900-dpr2.jpg` — 1600×900 @ DPR 2, 991493 bytes, sha256 `77c9d01f4415ce9e5f252eb307b89ef555cee6e43ab9f0d7c3e5ff713e0dc8b1`
- `runtime/1016/hero-host-1280x720-dpr1.jpg` — 1280×720 @ DPR 1, 259729 bytes, sha256 `2d0ffbd0776a7a4fc200bc71486eb7543970097da73289ab2f1abbea2a2ce243`
- `runtime/1016/hero-host-1280x720-dpr1-bust-name-sameframe.jpg` — 1280×720 bust+name same frame, sha256 `fc438438cbcb442f1c0cbc7d9e8d8a7700cdd0b2420dcb11841f8fe8c98bfa5a`

## Textures (hero.avatar.1016.v1 / hero.bust.1016.v1)

- `client/public/assets/art/v1/textures/1x/hero/avatar/1016.png` — 6261 bytes, sha256 `ab94c424a1b57f66b654cb3c461f5982af08d9985785f8b391498a61958ecd81`
- `client/public/assets/art/v1/textures/2x/hero/avatar/1016.png` — 20880 bytes, sha256 `7e165d29483316913690a9d8eb19e0a360fc9dd84e7c97a9eb221eef018d646f`
- `client/public/assets/art/v1/textures/1x/hero/bust/1016.png` — 30987 bytes, sha256 `05d352c4d2ce396b85a9facb65c1e754b36c9e2a17c94797f3932ad9cf0fc0b7`
- `client/public/assets/art/v1/textures/2x/hero/bust/1016.png` — 108200 bytes, sha256 `3df12d99d53117090688e255c87bff2e3eabc55ed15c422ab83815bb0148eabc`

## Probe summary

```json
{
  "probes": {
    "1600x900-dpr1": {
      "ok": true,
      "template_cfg_id": 1016,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "典韦",
      "listAvatarVisible": true,
      "dpr": 1,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1016.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1016.png",
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
      "template_cfg_id": 1016,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "典韦",
      "listAvatarVisible": true,
      "dpr": 2,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "2",
        "srcTail": "2x/hero/avatar/1016.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "2",
        "srcTail": "2x/hero/bust/1016.png",
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
      "template_cfg_id": 1016,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "典韦",
      "listAvatarVisible": true,
      "dpr": 1,
      "uiScale": 0.8,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1016.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1016.png",
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
      "text": "典韦"
    },
    "viewport": {
      "w": 1280,
      "h": 720,
      "dpr": 1
    }
  }
}
```
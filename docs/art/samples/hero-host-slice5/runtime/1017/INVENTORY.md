# HERO-HOST-SLICE5 runtime inventory — template 1017

tip_sha / runtime_code_sha: `3b9b7098d988483e3e507e0de5f1b5996255e1c8`
art_head_sha (Draft #1193): `9f15a34119c1bcb157399693a5420c0a2787a47a`

## Viewport captures

- `runtime/1017/hero-host-1600x900-dpr1.jpg` — 1600×900 @ DPR 1, 471110 bytes, sha256 `3b1be624bbb66296d3883e1b00d71dc746e1afb09a7c5abb17118dd69d97b38c`
- `runtime/1017/hero-host-1600x900-dpr2.jpg` — 1600×900 @ DPR 2, 986517 bytes, sha256 `6937b7474e7c273f38e86cf6107730a7b14e1194f8c7dafd97132bcefdc4160a`
- `runtime/1017/hero-host-1280x720-dpr1.jpg` — 1280×720 @ DPR 1, 259008 bytes, sha256 `b4425c7ad01bcd91cf42d4f8ac673794aa782e65fd92c0f69be0ea94ab10b2a9`
- `runtime/1017/hero-host-1280x720-dpr1-bust-name-sameframe.jpg` — 1280×720 bust+name same frame, sha256 `28a1a7cb3c3ac2392b8c30d719f01a9444c046abe080ed13db946cb4793206cc`

## Textures (hero.avatar.1017.v1 / hero.bust.1017.v1)

- `client/public/assets/art/v1/textures/1x/hero/avatar/1017.png` — 6413 bytes, sha256 `9f10697b109073d343cd70441ac65cece93b267324382bca3dceb96215c47929`
- `client/public/assets/art/v1/textures/2x/hero/avatar/1017.png` — 21286 bytes, sha256 `6c0a3f8ccbf554e048c7a301dad1f6789a136afc4f590a88d19cacfbd4217324`
- `client/public/assets/art/v1/textures/1x/hero/bust/1017.png` — 24633 bytes, sha256 `0216f8100314408ae10f120c020904ab19c29dc913f869f4da43ebf6f01170e2`
- `client/public/assets/art/v1/textures/2x/hero/bust/1017.png` — 85904 bytes, sha256 `77323fa260e93ae3a3ac8c4bee989c3cac6078304bad042e81d83f54b7d11641`

## Probe summary

```json
{
  "probes": {
    "1600x900-dpr1": {
      "ok": true,
      "template_cfg_id": 1017,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "许褚",
      "listAvatarVisible": true,
      "dpr": 1,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1017.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1017.png",
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
      "template_cfg_id": 1017,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "许褚",
      "listAvatarVisible": true,
      "dpr": 2,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "2",
        "srcTail": "2x/hero/avatar/1017.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "2",
        "srcTail": "2x/hero/bust/1017.png",
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
      "template_cfg_id": 1017,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "许褚",
      "listAvatarVisible": true,
      "dpr": 1,
      "uiScale": 0.8,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1017.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1017.png",
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
      "text": "许褚"
    },
    "viewport": {
      "w": 1280,
      "h": 720,
      "dpr": 1
    }
  }
}
```
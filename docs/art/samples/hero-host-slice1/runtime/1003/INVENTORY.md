# HERO-HOST-SLICE1 runtime inventory — template 1003

tip_sha / runtime_code_sha: `c520c83a751aa24065a90286632a32757e0fb7e7`
art_head_sha (Draft #1017): `d9d04ac15ded6e31c49139cb43afc28abe5a35b0`

## Viewport captures

- `runtime/1003/hero-host-1600x900-dpr1.jpg` — 1600×900 @ DPR 1, 471875 bytes, sha256 `854dc0b2a9f8abdabc913e00953156368ead1dd96f4f3b0060e25d3ac30f7854`
- `runtime/1003/hero-host-1600x900-dpr2.jpg` — 1600×900 @ DPR 2, 984365 bytes, sha256 `5a99ea6ec08fbb6a33cbe4be65dc961016041b76d11dfa43053e08ea2dda12ce`
- `runtime/1003/hero-host-1280x720-dpr1.jpg` — 1280×720 @ DPR 1, 257221 bytes, sha256 `6a0ad02c0ab0f2fbee8c866135949025829f49d3eb0e4d87582ff8279e8c75c1`
- `runtime/1003/hero-host-1280x720-dpr1-bust-name-sameframe.jpg` — 1280×720 bust+name same frame, sha256 `795d4760887baab512c3a8afc19ffe73391b45c208f8ee7ef4123e6f060ec448`

## Textures (hero.avatar.1003.v1 / hero.bust.1003.v1)

- `client/public/assets/art/v1/textures/1x/hero/avatar/1003.png` — 6370 bytes, sha256 `00810b4ae7516bef5cfbf6272d3cb2e4b482ed02e786eb3e0fcda4f48a2beefc`
- `client/public/assets/art/v1/textures/2x/hero/avatar/1003.png` — 21651 bytes, sha256 `c3ec9a8ea4d25e97e7902499f93bef4aaa85b5d3f8fdc720bb4faece658b911e`
- `client/public/assets/art/v1/textures/1x/hero/bust/1003.png` — 29880 bytes, sha256 `b87987089c279d736d18170288580f1ad21bd4f6c7ffe15c39fc712ee3b79f83`
- `client/public/assets/art/v1/textures/2x/hero/bust/1003.png` — 103827 bytes, sha256 `0ebd3adc663354970886cb6ed0cf391f6267eab7a5c7d721f850859876afe722`

## Probe summary

```json
{
  "probes": {
    "1600x900-dpr1": {
      "ok": true,
      "template_cfg_id": 1003,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "张飞",
      "listAvatarVisible": true,
      "dpr": 1,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1003.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1003.png",
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
      "template_cfg_id": 1003,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "张飞",
      "listAvatarVisible": true,
      "dpr": 2,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "2",
        "srcTail": "2x/hero/avatar/1003.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "2",
        "srcTail": "2x/hero/bust/1003.png",
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
      "template_cfg_id": 1003,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "张飞",
      "listAvatarVisible": true,
      "dpr": 1,
      "uiScale": 0.8,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1003.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1003.png",
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
      "text": "张飞"
    },
    "viewport": {
      "w": 1280,
      "h": 720,
      "dpr": 1
    }
  }
}
```
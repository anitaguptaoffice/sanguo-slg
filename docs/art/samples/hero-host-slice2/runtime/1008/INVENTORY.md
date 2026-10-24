# HERO-HOST-SLICE2 runtime inventory — template 1008

tip_sha / runtime_code_sha: `0e96842e67ea10e549db52fa427c6236e9072dcf`
art_head_sha (Draft #1069): `4af5abdccf9f882db0123ffb37753c24322be90e`

## Viewport captures

- `runtime/1008/hero-host-1600x900-dpr1.jpg` — 1600×900 @ DPR 1, 473590 bytes, sha256 `f785baf3b3a4c24459300ceb716d382d68380f6239af2bdc1449bcb71cbd5883`
- `runtime/1008/hero-host-1600x900-dpr2.jpg` — 1600×900 @ DPR 2, 990273 bytes, sha256 `1f87b18188fb01bdffdddd37a88b333e5d75a48ecc4cb59ccd1d2aaaac68960b`
- `runtime/1008/hero-host-1280x720-dpr1.jpg` — 1280×720 @ DPR 1, 257221 bytes, sha256 `6a0ad02c0ab0f2fbee8c866135949025829f49d3eb0e4d87582ff8279e8c75c1`
- `runtime/1008/hero-host-1280x720-dpr1-bust-name-sameframe.jpg` — 1280×720 bust+name same frame, sha256 `2cd911a11b4ec175941b3792471498b7eec68dcf0e6e35bf437b9fd8140a7b4f`

## Textures (hero.avatar.1008.v1 / hero.bust.1008.v1)

- `client/public/assets/art/v1/textures/1x/hero/avatar/1008.png` — 6657 bytes, sha256 `fdade41415033e2b7e1ed424db680c94ff96029ed0b49b74810729e7be217699`
- `client/public/assets/art/v1/textures/2x/hero/avatar/1008.png` — 21500 bytes, sha256 `a19242bd8e8595913cdf3feb854996733f161edb4c43cfe74944474786d1e1bf`
- `client/public/assets/art/v1/textures/1x/hero/bust/1008.png` — 29673 bytes, sha256 `5f234e8b034541677d6e26d33ff7c1fb29b1914899fa8dfcbe5683f3cea348b2`
- `client/public/assets/art/v1/textures/2x/hero/bust/1008.png` — 100423 bytes, sha256 `ee0a363c5ebff899ae80f61fdc62d8e5604f76308dced4a9d662501b1b106188`

## Probe summary

```json
{
  "probes": {
    "1600x900-dpr1": {
      "ok": true,
      "template_cfg_id": 1008,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "周瑜",
      "listAvatarVisible": true,
      "dpr": 1,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1008.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1008.png",
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
      "template_cfg_id": 1008,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "周瑜",
      "listAvatarVisible": true,
      "dpr": 2,
      "uiScale": 1,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "2",
        "srcTail": "2x/hero/avatar/1008.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "2",
        "srcTail": "2x/hero/bust/1008.png",
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
      "template_cfg_id": 1008,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "周瑜",
      "listAvatarVisible": true,
      "dpr": 1,
      "uiScale": 0.8,
      "avatar": {
        "cssWidth": 56,
        "cssHeight": 56,
        "borderRadius": "50%",
        "artTextureScale": "1",
        "srcTail": "1x/hero/avatar/1008.png"
      },
      "bust": {
        "cssWidth": 128,
        "cssHeight": 160,
        "artTextureScale": "1",
        "srcTail": "1x/hero/bust/1008.png",
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
      "text": "周瑜"
    },
    "viewport": {
      "w": 1280,
      "h": 720,
      "dpr": 1
    }
  }
}
```
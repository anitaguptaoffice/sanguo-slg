# HERO-HOST-1001 slice:0 runtime inventory

tip_sha / runtime_code_sha: `d078ca9d42e4256b0533b03f707b77e389db4ea3`
art_head_sha (Draft #983): `eef9514b507c3b21921987ab94232021422bdc2f`

## Viewport captures

- `runtime/hero-host-1600x900-dpr1.jpg` — 1600×900 @ DPR 1, 465787 bytes, sha256 `5f41c88570e2ce093eee3745261115aba94e95fa647cbf8cf4eb81004498a684`
- `runtime/hero-host-1600x900-dpr2.jpg` — 1600×900 @ DPR 2, 973216 bytes, sha256 `de1647f40c39d0b6363a13f3e7858ff5fc8d0d820ec085747a9ea326df47b7a2`
- `runtime/hero-host-1280x720-dpr1.jpg` — 1280×720 @ DPR 1, 257221 bytes, sha256 `6a0ad02c0ab0f2fbee8c866135949025829f49d3eb0e4d87582ff8279e8c75c1`

## Textures (hero.avatar.1001.v1 / hero.bust.1001.v1)

- `client/public/assets/art/v1/textures/1x/hero/avatar/1001.png` — 6036 bytes, sha256 `d7d7afeed6a6b15bebbc28be88ff614f58bc5643cb1db928f26b08bc296e4adc`
- `client/public/assets/art/v1/textures/2x/hero/avatar/1001.png` — 19499 bytes, sha256 `f8a48efec2b4f0cca45141e3b9f2e461c8631466285b1f60b11e660cff35ba46`
- `client/public/assets/art/v1/textures/1x/hero/bust/1001.png` — 31700 bytes, sha256 `060c9c658d95caa84ccd0d24375949df269367e2bb1f2838dc56889c5b15f74e`
- `client/public/assets/art/v1/textures/2x/hero/bust/1001.png` — 107047 bytes, sha256 `b7f6d088078138a6c2bbfaad752236f813c43047ebd5e9f44495040928000a08`

## Probe summary

```json
{
  "1600x900-dpr1": {
    "ok": true,
    "heroDetailLoaded": true,
    "detailName": "刘备",
    "dpr": 1,
    "uiScale": 1,
    "avatar": {
      "cssWidth": 56,
      "cssHeight": 56,
      "borderRadius": "50%",
      "artTextureScale": "1",
      "srcTail": "1x/hero/avatar/1001.png"
    },
    "bust": {
      "cssWidth": 128,
      "cssHeight": 160,
      "artTextureScale": "1",
      "srcTail": "1x/hero/bust/1001.png",
      "float": "left"
    },
    "layout": {
      "nameBesideBust": false,
      "headLeft": 662,
      "bustRight": 652
    },
    "texturePickOk": true,
    "usesAvatar1x": true,
    "usesAvatar2x": false,
    "usesBust1x": true,
    "usesBust2x": false,
    "scrollReachOk": true,
    "detailFooterVisible": true
  },
  "1600x900-dpr2": {
    "ok": true,
    "heroDetailLoaded": true,
    "detailName": "刘备",
    "dpr": 2,
    "uiScale": 1,
    "avatar": {
      "cssWidth": 56,
      "cssHeight": 56,
      "borderRadius": "50%",
      "artTextureScale": "2",
      "srcTail": "2x/hero/avatar/1001.png"
    },
    "bust": {
      "cssWidth": 128,
      "cssHeight": 160,
      "artTextureScale": "2",
      "srcTail": "2x/hero/bust/1001.png",
      "float": "left"
    },
    "layout": {
      "nameBesideBust": false,
      "headLeft": 662,
      "bustRight": 652
    },
    "texturePickOk": true,
    "usesAvatar1x": false,
    "usesAvatar2x": true,
    "usesBust1x": false,
    "usesBust2x": true,
    "scrollReachOk": true,
    "detailFooterVisible": true
  },
  "1280x720-dpr1": {
    "ok": true,
    "heroDetailLoaded": true,
    "detailName": "刘备",
    "dpr": 1,
    "uiScale": 0.8,
    "avatar": {
      "cssWidth": 56,
      "cssHeight": 56,
      "borderRadius": "50%",
      "artTextureScale": "1",
      "srcTail": "1x/hero/avatar/1001.png"
    },
    "bust": {
      "cssWidth": 128,
      "cssHeight": 160,
      "artTextureScale": "1",
      "srcTail": "1x/hero/bust/1001.png",
      "float": "left"
    },
    "layout": {
      "nameBesideBust": false,
      "headLeft": 502,
      "bustRight": 492
    },
    "texturePickOk": true,
    "usesAvatar1x": true,
    "usesAvatar2x": false,
    "usesBust1x": true,
    "usesBust2x": false,
    "scrollReachOk": true,
    "detailFooterVisible": true
  }
}
```
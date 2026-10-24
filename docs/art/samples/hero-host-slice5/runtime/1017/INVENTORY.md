# HERO-HOST-SLICE5 runtime inventory — template 1017

## Git provenance（勿混用）

| 角色 | SHA | 说明 |
|---|---|---|
| **runtime_code_sha / tip_sha** | `d7cc3a62f9115572b3fa2fc77725828f563dd2df` | 生产 runtime（scroll/clip host，`HeroMailPanels` 所在提交） |
| **HeroMailPanels.ts blob** | `3dc43b682fa39b23c38ec183c985a967e51a03d2` | 在 d7cc3a62 / e65fefe2 / 15d1b425 上相同 |
| **evidence_head_sha** | `15d1b425abb20cab48ebb7ecf779a947151d25d7` | #1198 证据包 HEAD（写入 probe 时） |
| **capture_helper_commit_sha** | `15d1b425abb20cab48ebb7ecf779a947151d25d7` | 捕获脚本提交；blob 与 d7cc3a62 不同（见 probe-log notes） |
| **prior_capture_record_sha** | `e65fefe2e4c83ff68f1fb5371df02e89e21ac990` | 上一轮 Slice5 runtime 刷新基线 |

art_head_sha: `9f15a34119c1bcb157399693a5420c0a2787a47a`

## Viewport captures

- `runtime/1017/hero-host-1600x900-dpr1.jpg` — 1600×900 @ DPR 1, 476907 bytes, sha256 `369168f60d40acbfa696189b46d2eff857cb969bcf098f6add84785fc3d5c2b9`
- `runtime/1017/hero-host-1600x900-dpr2.jpg` — 1600×900 @ DPR 2, 937325 bytes, sha256 `d00f670f2c1231965ccb875ef114cb0e93ab58bfb4bda986c4b175ceb03910b6`
- `runtime/1017/hero-host-1280x720-dpr1-bust-name-sameframe.jpg` — 1280×720 bust+name same frame, sha256 `809cbccb3b13d31c4cb9e9931c3170db96ab517d1a21e2a59a21e51305ef08cc`

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
      "listAvatarInClip": true,
      "listNameInClip": true,
      "listAvatarRoundMask": true,
      "listRowTemplateOk": true,
      "listAvatarFrameOk": true,
      "listRowPrimaryText": "许褚 · Lv9 · 忠诚 83",
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
      "detailFooterVisible": true,
      "detailFooterTopInScroll": true,
      "detailFooterBottomInScroll": true,
      "bustNameInClip": false,
      "visibleClip": {
        "left": 524,
        "top": 941.96875,
        "width": 128,
        "height": 0
      },
      "listVisibleClip": {
        "left": 516,
        "top": 208.1875,
        "width": 568,
        "height": 599.8125
      }
    },
    "1600x900-dpr2": {
      "ok": true,
      "template_cfg_id": 1017,
      "heroDetailLoaded": true,
      "nameReadable": true,
      "detailName": "许褚",
      "listAvatarVisible": true,
      "listAvatarInClip": true,
      "listNameInClip": true,
      "listAvatarRoundMask": true,
      "listRowTemplateOk": true,
      "listAvatarFrameOk": true,
      "listRowPrimaryText": "许褚 · Lv9 · 忠诚 83",
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
      "detailFooterVisible": true,
      "detailFooterTopInScroll": true,
      "detailFooterBottomInScroll": true,
      "bustNameInClip": false,
      "visibleClip": {
        "left": 524,
        "top": 941.96875,
        "width": 128,
        "height": 0
      },
      "listVisibleClip": {
        "left": 516,
        "top": 208.1875,
        "width": 568,
        "height": 599.8125
      }
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
      "detailFooterVisible": true,
      "detailFooterTopInScroll": true,
      "detailFooterBottomInScroll": true,
      "bustNameInClip": false,
      "visibleClip": {
        "left": 364,
        "top": 174.984375,
        "width": 128,
        "height": 0
      }
    }
  },
  "sameframe": {
    "ok": true,
    "bustInClip": true,
    "nameInClip": true,
    "bustInViewport": true,
    "nameInViewport": true,
    "nameRightOfBust": true,
    "verticalBandOverlap": true,
    "gapPx": 10,
    "gapNear10px": true,
    "visibleClip": {
      "left": 356,
      "top": 174.984375,
      "width": 568,
      "height": 464.21875
    },
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
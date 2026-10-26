# CLIENT-REPORT-READABILITY

Read-only native evidence: `34-native-report1-round8-survivors.png` from
`browser-runtime/combined-natural-battle/` showed inherited brown text on the
near-black report table. Repair only the battle-report rounds table and its
header/body/highlight cells: theme ivory #e8dcc8 on existing dark surfaces,
14px/1.5 type. Other panels, historical hero styles and art are untouched.

The fixture is the exact recorded `native-report1-detail.json` (SHA-256
`85882856a76f77350777b1079c597fbc3f79f2fff89d8e18d82ae55f5f9f7c1f`), eight rounds,
200 initial infantry / 34 losses / 166 survivors. No combat value is changed.

Run `npm test -- --maxWorkers=2`, `npm run build`, then serially
`QA_OUT=/tmp/report-readability node qa/reportReadability.browser.mjs`.
The Chromium fixture uses production component/CSS/layout/art and recorded data,
not a live gateway, DB or native backend acceptance. It checks 1280/1600, art
on/off, headers/ordinary/highlighted round 8, reopen, actual font size, >=4.5
contrast and no horizontal overflow. Inspect the captured screenshots too.

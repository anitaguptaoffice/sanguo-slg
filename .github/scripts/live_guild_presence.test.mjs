import assert from 'node:assert/strict';
import { checkText, readable, productPins, paintSurface, fixedSummary, baselineSummary, focusGate, expectedDefects } from './live_guild_presence.mjs';
let count = 0;
const check = (name, fn) => { fn(); count++; console.log(`PASS ${name}`); };
function state(mode, expanded = true) {
  const summary = mode === 'fixed' ? '在线未知 / 共 1 人' : '在线 0 / 共 1 人';
  const phrase = mode === 'fixed' ? '本组在线 未知/1' : '本组在线 0/1';
  return { summary, headers: [Array(8).fill(phrase).join(' · ')], count: '1', expanded: String(expanded), rows: expanded ? 1 : 0 };
}
for (const mode of ['baseline', 'fixed']) {
  check(`${mode} preserves all eight segments and count`, () => checkText(state(mode), mode, true));
  check(`${mode} collapsed still has all eight segments`, () => checkText(state(mode, false), mode, false));
  check(`${mode} reopen honestly keeps summary without roster`, () => checkText({ ...state(mode), headers: [], rows: 0 }, mode, true, true));
  check(`${mode} rejects opposite presence meaning`, () => assert.throws(() => checkText(state(mode === 'fixed' ? 'baseline' : 'fixed'), mode, true)));
  check(`${mode} rejects missing/extra residual segments`, () => {
    for (const extra of [1, -1]) { const s = state(mode); s.headers[0] = s.headers[0].split(' · ').slice(0, 7).join(' · ') + (extra > 0 ? ' · ' + s.headers[0] : ''); assert.throws(() => checkText(s, mode, true)); }
  });
  check(`${mode} rejects wrong count, rows, disclosure, summary or phantom header`, () => {
    for (const change of [{ count: '2' }, { rows: 0 }, { expanded: 'false' }, { summary: '' }, { headers: [] }])
      assert.throws(() => checkText({ ...state(mode), ...change }, mode, true));
    assert.throws(() => checkText(state(mode), mode, true, true));
  });
}
const surface = { color: 'rgb(36, 23, 15)', image: 'none', borderImage: 'none', slice: '100%', opacity: 1, filter: 'none', backdrop: 'none', blend: 'normal', mask: 'none', pseudo: false };
const sample = { font: 10, opacity: 1, ink: 'rgb(255, 243, 214)', chain: [surface], rects: [{ width: 40, height: 12, visible: true, hit: true }] };
check('visible full text at minimum contrast is readable', () => assert.equal(readable(sample), true));
check('reject clipped, occluded, invisible, tiny, empty or low-contrast text', () => {
  for (const change of [{ font: 9 }, { opacity: 0 }, { opacity: .5 }, { ink: 'rgb(37, 24, 16)' }, { rects: [] },
    { rects: [{ ...sample.rects[0], visible: false }] }, { rects: [{ ...sample.rects[0], hit: false }] },
    { rects: [{ ...sample.rects[0], width: 0 }] }, { rects: [{ ...sample.rects[0], height: 0 }] }]) assert.equal(readable({ ...sample, ...change }), false);
});
check('every wrapped fragment must be readable', () => assert.equal(readable({ ...sample, rects: [sample.rects[0], { ...sample.rects[0], visible: false }] }), false));
check('invalid mode cannot manufacture acceptance', () => assert.throws(() => checkText(state('fixed'), 'unknown', true)));

check('product labels bind immutable heads and trees', () => {
  const env = { QA_PRODUCT: 'fixed', QA_PRODUCT_HEAD: '1ae318cf46321985a89b4e2cae06ea3d9527fb80', QA_PRODUCT_TREE: 'ed2662eeb2328b05784e4dc8e66fc9493eb426f0' };
  productPins(env); assert.throws(() => productPins({ ...env, QA_PRODUCT: 'baseline' })); assert.throws(() => productPins({ ...env, QA_PRODUCT_TREE: 'a'.repeat(40) }));
});

const transparent = { ...surface, color: 'rgba(0, 0, 0, 0)' };
const artwork = { ...transparent, panel: 'guild', slice: '24 24 24 24 fill', borderImage: 'url("http://127.0.0.1:5173/assets/art/v1/textures/1x/ui/panel_default.png")' };
const baseline = { ...sample, ink: 'rgb(245, 230, 200)', chain: [transparent, artwork, surface] };
check('actual filled-artwork regression never borrows dark body background', () => {
  assert.equal(paintSurface(baseline).reason, 'artwork'); assert.equal(readable(baseline), false); baselineSummary(baseline);
  assert.equal(readable({ ...sample, chain: [surface, artwork] }), true); fixedSummary(sample);
  assert.throws(() => fixedSummary({ ...sample, chain: [transparent, surface, artwork] }));
  assert.equal(readable({ ...sample, chain: [transparent, surface, artwork] }), true);
});
check('unsupported paints and compositing effects fail closed', () => {
  for (const change of [{ image: 'url(art.png)' }, { borderImage: 'url(art.png)' }, { color: 'rgba(36, 23, 15, 0.5)' },
    { color: 'color(srgb 0 0 0)' }, { color: 'rgb(999, 0, 0)' }, { opacity: .5 }, { filter: 'brightness(.5)' },
    { backdrop: 'blur(2px)' }, { blend: 'multiply' }, { mask: 'url(mask.png)' }, { pseudo: true }])
    assert.equal(readable({ ...sample, chain: [{ ...surface, ...change }] }), false);
  assert.equal(readable({ ...sample, ink: 'rgba(255, 243, 214, 0.5)' }), false);
  assert.equal(readable({ ...sample, chain: [transparent] }), false);
});
check('baseline permits only exact independently witnessed defects', () => {
  for (const mutate of [s => s.ink = 'rgb(255, 255, 255)', s => s.chain[1].panel = 'hero', s => s.chain[1].borderImage = 'url(other.png)', s => s.chain[1].slice = '24', s => s.chain[0].filter = 'blur(1px)']) {
    const changed = structuredClone(baseline); mutate(changed); assert.throws(() => baselineSummary(changed));
  }
  focusGate({ focusInPanel: false, focusTag: 'BODY' }, true); focusGate({ focusInPanel: true, focusAction: 'toggle-guild-role-group', focusRole: '1' }, false);
  assert.throws(() => focusGate({ focusInPanel: true, focusAction: 'refresh-members', focusRole: '1' }, false));
  assert.throws(() => focusGate({ focusInPanel: true, focusAction: 'toggle-guild-role-group', focusRole: '2' }, false));
  assert.throws(() => focusGate({ focusInPanel: false, focusTag: 'BUTTON' }, true)); assert.throws(() => focusGate({ focusInPanel: false }, false));
  const known = ['summary-artwork-contrast', 'role-toggle-body-focus', 'escape-remains-open']; expectedDefects(known);
  assert.throws(() => expectedDefects(known.slice(0, 2))); assert.throws(() => expectedDefects([...known, 'extra']));
});
console.log(`PASS ${count} scenario negative-control groups; not native rendering evidence`);

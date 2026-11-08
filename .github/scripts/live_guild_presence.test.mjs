import assert from 'node:assert/strict';
import { checkText, readable, productPins } from './live_guild_presence.mjs';
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
const sample = { font: 10, opacity: 1, contrast: 4.5, rects: [{ width: 40, height: 12, visible: true, hit: true }] };
check('visible full text at minimum contrast is readable', () => assert.equal(readable(sample), true));
check('reject clipped, occluded, invisible, tiny, empty or low-contrast text', () => {
  for (const change of [{ font: 9 }, { opacity: 0 }, { opacity: .5 }, { contrast: 4.49 }, { rects: [] },
    { rects: [{ ...sample.rects[0], visible: false }] }, { rects: [{ ...sample.rects[0], hit: false }] },
    { rects: [{ ...sample.rects[0], width: 0 }] }, { rects: [{ ...sample.rects[0], height: 0 }] }]) assert.equal(readable({ ...sample, ...change }), false);
});
check('every wrapped fragment must be readable', () => assert.equal(readable({ ...sample, rects: [sample.rects[0], { ...sample.rects[0], visible: false }] }), false));
check('invalid mode cannot manufacture acceptance', () => assert.throws(() => checkText(state('fixed'), 'unknown', true)));

check('product labels bind immutable heads and trees', () => {
  const env = { QA_PRODUCT: 'fixed', QA_PRODUCT_HEAD: '00b292a9c1f7ab3ec5d6c868c8667cbcf03681bc', QA_PRODUCT_TREE: '1949038fc542b545a229de4bcf96c86580a08514' };
  productPins(env); assert.throws(() => productPins({ ...env, QA_PRODUCT: 'baseline' })); assert.throws(() => productPins({ ...env, QA_PRODUCT_TREE: 'a'.repeat(40) }));
});
console.log(`PASS ${count} scenario negative-control groups; not native rendering evidence`);

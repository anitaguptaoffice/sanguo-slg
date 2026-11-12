import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifyClassification, verifyGeometry, verifyView } from './live_mail_keyboard.mjs';

const geometry = { x: 20, y: 20, width: 180, height: 50, viewportWidth: 1280, viewportHeight: 720,
  clips: [{ x: true, y: true, left: 0, top: 0, right: 220, bottom: 100 }], siblings: [{ left: 0, top: 20, right: 15, bottom: 40 }],
  scrollWidth: 180, clientWidth: 180, hit: true, active: true, focusVisible: true, outlineWidth: '2px', outlineStyle: 'solid' };
test('finite native geometry accepts both declared viewport sizes', () => {
  verifyGeometry(geometry, true);
  verifyGeometry({ ...geometry, viewportWidth: 1600, viewportHeight: 900 }, true);
});
for (const [key, value] of Object.entries({ x: -1, y: -1, width: 0, height: 0, viewportWidth: 40,
  viewportHeight: 40, scrollWidth: 190, clientWidth: 0, hit: false, active: false,
  focusVisible: false, outlineWidth: '1px', outlineStyle: 'none' })) {
  test(`geometry rejects ${key}`, () => assert.throws(() => verifyGeometry({ ...geometry, [key]: value }, true)));
}
for (const key of ['x', 'y', 'width', 'height', 'viewportWidth', 'viewportHeight', 'scrollWidth', 'clientWidth']) {
  test(`geometry rejects nonfinite ${key}`, () => assert.throws(() => verifyGeometry({ ...geometry, [key]: NaN })));
}
const view = { ids: [4, 3, 2, 1], body: 'B', focus: 3, checked: true, nestedInputs: 0 };
test('native settled body/focus/order and sibling selection', () => verifyView(view, view));
for (const [key, value] of Object.entries({ ids: [4, 2, 3, 1], body: 'A', focus: 4, checked: false, nestedInputs: 1 })) {
  test(`settled view rejects ${key}`, () => assert.throws(() => verifyView({ ...view, [key]: value }, view)));
}
const cases = ['open', 'tab-b', 'read-b', 'checkbox', 'unread', 'read-a', 'read-d', 'read-c'];
const result = { product: 'fixed', viewport: { width: 1280, height: 720 }, resultKind: 'native-candidate', nativeAcceptance: false,
  cases, screenshots: cases.map(name => `mail-fixed-${name}`), defectObserved: false };
test('fixed and baseline remain independent-review candidates', () => {
  verifyClassification(result);
  verifyClassification({ ...result, product: 'baseline', resultKind: 'baseline-defect-control', defectObserved: true });
});
for (const [key, value] of Object.entries({ product: 'unknown', resultKind: 'baseline-defect-control', nativeAcceptance: true,
  cases: cases.slice(1), screenshots: Array(8).fill('same'), defectObserved: true, viewport: { width: 1400, height: 900 } })) {
  test(`classification rejects ${key}`, () => assert.throws(() => verifyClassification({ ...result, [key]: value })));
}
test('baseline cannot mask missing actions or imply native success', () => {
  assert.throws(() => verifyClassification({ ...result, product: 'baseline', defectObserved: true }));
  assert.throws(() => verifyClassification({ ...result, screenshots: [] }));
});
test('ancestor clipping and off-center sibling overlap cannot pass', () => {
  for (const override of [{ left: 22 }, { right: 190 }, { top: 22 }, { bottom: 65 }]) {
    assert.throws(() => verifyGeometry({ ...geometry, clips: [{ ...geometry.clips[0], ...override }] }));
  }
  assert.throws(() => verifyGeometry({ ...geometry, siblings: [{ left: 195, right: 210, top: 20, bottom: 30 }] }));
  assert.throws(() => verifyGeometry({ ...geometry, clips: undefined }));
  assert.throws(() => verifyGeometry({ ...geometry, siblings: undefined }));
});

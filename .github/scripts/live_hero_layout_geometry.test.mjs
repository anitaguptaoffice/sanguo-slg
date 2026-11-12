import assert from 'node:assert/strict';
import {
  inspect, visibleTarget, usableRoster, layoutSignature, hasFullVisibility,
  wheelReady, wheelPlan, targetDelta, toggleDirection, assertDirections, wheelPosition,
} from './live_hero_layout_geometry.mjs';

const rect = { x: 10, y: 10, width: 100, height: 100, left: 10, top: 10, right: 110, bottom: 110 };
const node = (className, box = rect) => ({ tagName: 'SPAN', className, getAttribute: () => null, getBoundingClientRect: () => box, clientLeft: 0, clientTop: 0, clientWidth: box.width, clientHeight: box.height, contains(hit) { return hit === this; } });
const target = node('target'), parent = node('clip', { ...rect, width: 50, right: 60 }); target.parentElement = parent;
globalThis.innerWidth = 1280; globalThis.innerHeight = 720;
globalThis.getComputedStyle = () => ({ overflowX: 'hidden', overflowY: 'hidden' }); globalThis.document = { elementFromPoint: () => target };
let value = inspect(target); assert.equal(value.points.length, 9); assert.equal(value.visible.right, 60); visibleTarget(value);
assert.throws(() => visibleTarget(value, true), /width is clipped/);
document.elementFromPoint = () => parent; assert.throws(() => visibleTarget(inspect(target)), /No sampled target hit/);
document.elementFromPoint = () => null; assert.throws(() => visibleTarget(inspect(target)), /No sampled target hit/);
parent.getBoundingClientRect = () => ({ ...rect, left: 200, right: 250 }); assert.throws(() => visibleTarget(inspect(target)), /fully clipped/);
document.elementFromPoint = () => target; parent.getBoundingClientRect = () => ({ ...rect, height: 50, bottom: 60 }); parent.clientHeight = 50;
assert.throws(() => visibleTarget(inspect(target), true), /height is clipped/);
target.getBoundingClientRect = () => ({ ...rect, height: 0, bottom: 10 }); assert.throws(() => visibleTarget(inspect(target)), /positive dimensions/);
const rosterBoundary = { roster: { rect: { x: 10, y: 20, width: 100, height: 64 }, visible: { left: 10, top: 20, right: 110, bottom: 84 }, points: [{ reachesTarget: true }] }, panel: { rect: { y: 20, height: 64 } }, toolbar: { rect: { y: 84 } } };
usableRoster(rosterBoundary);
assert.equal(hasFullVisibility(rosterBoundary.roster), true); assert.equal(hasFullVisibility(value), false);
let invalid = structuredClone(rosterBoundary); invalid.roster.rect.height = 63; invalid.roster.visible.bottom = 83;
assert.throws(() => usableRoster(invalid), /less than64px/);
invalid = structuredClone(rosterBoundary); invalid.panel.rect.y = 21; assert.throws(() => usableRoster(invalid), /starts outside panel/);
invalid = structuredClone(rosterBoundary); invalid.panel.rect.height = 62; assert.throws(() => usableRoster(invalid), /ends outside panel/);
invalid = structuredClone(rosterBoundary); invalid.toolbar.rect.y = 82; assert.throws(() => usableRoster(invalid), /overlaps bottom toolbar/);
const longRegion = { ...rosterBoundary.roster, scrollHeight: 15000, clientHeight: 64, points: [{ x: 60, y: 52, reachesTarget: true }] };
assert.deepEqual(wheelPlan(longRegion, 'top'), { x: 60, y: 52, delta: -15064 }); assert.equal(wheelPlan(longRegion, 'bottom').delta, 15064);
assert.throws(() => wheelPlan({ ...longRegion, points: [] }, 'top')); assert.throws(() => wheelPlan(longRegion, 0)); assert.throws(() => wheelPlan(longRegion, 'sideways'));
assert.throws(() => wheelPlan(longRegion, NaN));
const ready = { hit: true, open: true, scrollHeight: 100, clientHeight: 50 }; assert.equal(wheelReady(ready), true);
for (const change of [{ hit: false }, { open: false }, { scrollHeight: 50 }, { scrollHeight: 51 }]) assert.equal(wheelReady({ ...ready, ...change }), false);
const positionCases = [
  { scrollTop: 0, top: true, expected: true },
  { start: 40, scrollTop: 1, top: true, expected: true },
  { start: 0, scrollTop: 0, top: true, expected: false },
  { start: 0, scrollTop: 40, top: false, open: undefined, expected: true },
  { scrollTop: 2, top: true, expected: false },
  { start: 40, scrollTop: 0, top: true, scrollHeight: 51, expected: false },
  { start: 0, scrollTop: 40, top: false, expected: true },
  { start: 40, scrollTop: 0, top: true, expected: true },
  { start: 40, scrollTop: 40, top: false, expected: false },
  { start: 40, scrollTop: 0, top: true, open: false, expected: false },
  { start: 40, scrollTop: 0, top: true, scrollHeight: 50, expected: false },
  { start: 40, scrollTop: 20, top: false, expected: false },
  { start: 0, scrollTop: 40, top: true, expected: false },
];
for (const test of positionCases) {
  document.querySelector = () => ({ ...ready, ...test });
  assert.equal(wheelPosition({ selector: 'actual-region', top: test.top, start: test.start }), test.expected);
}
assert.equal(layoutSignature({ at: 1, details: [true] }), layoutSignature({ at: 2, details: [true] }));
assert.notEqual(layoutSignature({ at: 1, details: [true] }), layoutSignature({ at: 2, details: [false] }));
assert.equal(toggleDirection(false, false), null); assertDirections([toggleDirection(false, true), toggleDirection(true, false)]);
for (const partial of [[], ['open'], ['close'], ['open', 'open', null]]) assert.throws(() => assertDirections(partial));
assert.equal(targetDelta({ roster: { visible: { top: 20, bottom: 84 } }, name: { rect: { y: 90, height: 18 } }, avatar: { rect: { y: 90, height: 56 } } }), 70);
assert.equal(targetDelta({ roster: { visible: { top: 20, bottom: 84 } }, name: { rect: { y: -10, height: 18 } }, avatar: { rect: { y: -10, height: 56 } } }), -38);
assert.throws(() => targetDelta({ roster: { visible: { top: 20, bottom: 84 } }, name: { rect: { y: 20, height: 18 } }, avatar: { rect: { y: 20, height: 56 } } }), /non-vertical/);
console.log('PASS actual geometry, readiness, direction and movement helpers; no browser/services');

import assert from 'node:assert/strict';

function inspect(el) {
  const describe = node => node ? `${node.tagName.toLowerCase()}#${node.id || ''}.${node.className} ${node.getAttribute('data-role') || node.getAttribute('data-action') || ''}` : null;
  const rect = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
  const bounds = el.getBoundingClientRect(), chain = []; let clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
  for (let ancestor = el; ancestor; ancestor = ancestor.parentElement) {
    const r = ancestor.getBoundingClientRect(), css = getComputedStyle(ancestor);
    chain.push({ name: describe(ancestor), rect: rect(ancestor), overflowX: css.overflowX, overflowY: css.overflowY,
      display: css.display, visibility: css.visibility, position: css.position, zIndex: css.zIndex,
      scrollTop: ancestor.scrollTop, clientHeight: ancestor.clientHeight, scrollHeight: ancestor.scrollHeight });
    if (ancestor !== el && /auto|scroll|hidden|clip/.test(css.overflowX)) { clip.left = Math.max(clip.left, r.left + ancestor.clientLeft); clip.right = Math.min(clip.right, r.left + ancestor.clientLeft + ancestor.clientWidth); }
    if (ancestor !== el && /auto|scroll|hidden|clip/.test(css.overflowY)) { clip.top = Math.max(clip.top, r.top + ancestor.clientTop); clip.bottom = Math.min(clip.bottom, r.top + ancestor.clientTop + ancestor.clientHeight); }
  }
  const visible = { left: Math.max(clip.left, bounds.left), top: Math.max(clip.top, bounds.top), right: Math.min(clip.right, bounds.right), bottom: Math.min(clip.bottom, bounds.bottom) }, points = [];
  if (visible.right > visible.left && visible.bottom > visible.top) for (const fy of [0.1, 0.5, 0.9]) for (const fx of [0.1, 0.5, 0.9]) {
    const x = visible.left + (visible.right - visible.left) * fx, y = visible.top + (visible.bottom - visible.top) * fy, hit = document.elementFromPoint(x, y);
    points.push({ x, y, hit: describe(hit), reachesTarget: !!hit && el.contains(hit) });
  }
  return { at: Date.now(), open: 'open' in el ? el.open : null, name: describe(el), rect: rect(el), visible, points, ancestors: chain, scrollTop: el.scrollTop, clientHeight: el.clientHeight, scrollHeight: el.scrollHeight };
}
function visibleTarget(value, fullyVisible = false) {
  assert.ok(value.rect.width > 0 && value.rect.height > 0, 'Target has no positive dimensions');
  assert.ok(value.visible.right > value.visible.left && value.visible.bottom > value.visible.top, 'Target is fully clipped');
  assert.ok(value.points.some(point => point.reachesTarget), 'No sampled target hit');
  if (fullyVisible) {
    assert.ok(value.visible.bottom - value.visible.top >= value.rect.height - 1, 'Target height is clipped');
    assert.ok(value.visible.right - value.visible.left >= value.rect.width - 1, 'Target width is clipped');
  }
}
function usableRoster(geometry) {
  visibleTarget(geometry.roster);
  assert.ok(geometry.roster.visible.bottom - geometry.roster.visible.top >= 64, 'Roster has less than64px usable height');
  assert.ok(geometry.roster.rect.y >= geometry.panel.rect.y, 'Roster starts outside panel');
  assert.ok(geometry.roster.rect.y + geometry.roster.rect.height <= geometry.panel.rect.y + geometry.panel.rect.height + 1, 'Roster ends outside panel');
  assert.ok(geometry.roster.visible.bottom <= geometry.toolbar.rect.y + 1, 'Roster overlaps bottom toolbar');
}
const layoutSignature = ({ at, ...layout }) => JSON.stringify(layout);
const hasFullVisibility = value => { try { visibleTarget(value, true); return true; } catch { return false; } };
const wheelReady = current => current.hit && current.open !== false && current.scrollHeight > current.clientHeight + 1;
function wheelPlan(region, direction) {
  visibleTarget(region); assert.ok(typeof direction === 'number' || ['top', 'bottom'].includes(direction));
  const center = { x: (region.visible.left + region.visible.right) / 2, y: (region.visible.top + region.visible.bottom) / 2 };
  const point = region.points.filter(p => p.reachesTarget).sort((a, b) => Math.hypot(a.x - center.x, a.y - center.y) - Math.hypot(b.x - center.x, b.y - center.y))[0];
  const delta = typeof direction === 'number' ? direction : (direction === 'top' ? -1 : 1) * Math.ceil(region.scrollHeight + region.clientHeight);
  assert.ok(Number.isFinite(delta) && delta !== 0); return { x: point.x, y: point.y, delta };
}
function targetDelta(geometry) {
  const top = Math.min(geometry.name.rect.y, geometry.avatar.rect.y), bottom = Math.max(geometry.name.rect.y + geometry.name.rect.height, geometry.avatar.rect.y + geometry.avatar.rect.height);
  assert.ok(top < geometry.roster.visible.top || bottom > geometry.roster.visible.bottom, 'Wheel cannot repair non-vertical clipping or occlusion');
  return top < geometry.roster.visible.top ? Math.floor(top - geometry.roster.visible.top - 8) : Math.ceil(bottom - geometry.roster.visible.bottom + 8);
}
const toggleDirection = (before, after) => before === after ? null : (after ? 'open' : 'close');
const assertDirections = values => assert.deepEqual([...new Set(values.filter(Boolean))].sort(), ['close', 'open']);
function wheelPosition({ selector, top, start = null }) {
  const node = document.querySelector(selector);
  return node.open !== false && node.scrollHeight > node.clientHeight + 1 && (top ? node.scrollTop <= 1 && (start === null || node.scrollTop < start) : node.scrollTop > 1 && (start === null || node.scrollTop > start));
}
export {
  inspect, visibleTarget, usableRoster, layoutSignature, hasFullVisibility,
  wheelReady, wheelPlan, targetDelta, toggleDirection, assertDirections, wheelPosition,
};

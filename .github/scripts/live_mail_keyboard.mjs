import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export function verifyGeometry(view, focused = false) {
  for (const key of ['x', 'y', 'width', 'height', 'viewportWidth', 'viewportHeight', 'scrollWidth', 'clientWidth']) assert.ok(Number.isFinite(view[key]), 'invalid geometry');
  assert.ok(view.width > 0 && view.height > 0 && view.x >= 0 && view.y >= 0, 'hidden target');
  assert.ok(view.x + view.width <= view.viewportWidth + 1 && view.y + view.height <= view.viewportHeight + 1, 'clipped target');
  assert.ok(view.scrollWidth <= view.clientWidth + 1 && view.hit, 'overflow or occlusion');
  assert.ok(Array.isArray(view.clips) && Array.isArray(view.siblings), 'missing clipping/sibling observations');
  for (const clip of view.clips) {
    for (const key of ['left', 'top', 'right', 'bottom']) assert.ok(Number.isFinite(clip[key]));
    assert.ok(!clip.x || (view.x >= clip.left - 1 && view.x + view.width <= clip.right + 1), 'ancestor horizontal clipping');
    assert.ok(!clip.y || (view.y >= clip.top - 1 && view.y + view.height <= clip.bottom + 1), 'ancestor vertical clipping');
  }
  for (const sibling of view.siblings) {
    for (const key of ['left', 'top', 'right', 'bottom']) assert.ok(Number.isFinite(sibling[key]));
    assert.ok(view.x + view.width <= sibling.left || view.x >= sibling.right || view.y + view.height <= sibling.top || view.y >= sibling.bottom, 'title/checkbox overlap');
  }
  if (focused) assert.ok(view.active && view.focusVisible && parseFloat(view.outlineWidth) >= 2 && view.outlineStyle !== 'none', 'invisible keyboard focus');
}

export function verifyView(view, expected) {
  assert.deepEqual(view.ids, expected.ids, 'wrong inbox order');
  assert.equal(view.body, expected.body, 'wrong detail body');
  if (expected.focus !== undefined) assert.equal(view.focus, expected.focus, 'wrong settled focus');
  if (expected.checked !== undefined) assert.equal(view.checked, expected.checked, 'checkbox state changed');
  assert.equal(view.nestedInputs, 0, 'checkbox nested in title');
}

export function verifyClassification(result) {
  assert.ok(['baseline', 'fixed'].includes(result.product));
  assert.equal(result.resultKind, result.product === 'fixed' ? 'native-candidate' : 'baseline-defect-control');
  assert.equal(result.nativeAcceptance, false, 'independent review and cleanup still required');
  assert.deepEqual(result.cases, ['open', 'tab-b', 'read-b', 'checkbox', 'unread', 'read-a', 'read-d', 'read-c']);
  assert.equal(result.screenshots.length, 8);
  assert.equal(new Set(result.screenshots).size, 8);
  assert.equal(result.defectObserved, result.product === 'baseline');
  assert.deepEqual(result.viewport, { width: result.viewport.width, height: result.viewport.width === 1280 ? 720 : 900 });
  assert.ok([1280, 1600].includes(result.viewport.width));
}

export async function runMailScenario({ page, action, fixtures, step, screenshot, report }) {
  const product = process.env.QA_PRODUCT;
  assert.ok(['baseline', 'fixed'].includes(product), 'unknown product');
  const fixed = product === 'fixed';
  const byLabel = Object.fromEntries(fixtures.map(row => [row.label, row]));
  const { A, B, C, D } = byLabel;
  assert.equal(fixtures.length, 4);
  const row = id => page.locator(`[data-role="mail-list"] li[data-mail-id="${id}"]`);
  const title = id => row(id).locator('.mail-row-title');
  const checkbox = row(D.id).locator('[data-role="mail-batch-checkbox"]');
  const result = { product, viewport: page.viewportSize(), resultKind: fixed ? 'native-candidate' : 'baseline-defect-control', nativeAcceptance: false,
    cases: [], screenshots: [], defectObserved: false, geometry: [] };
  async function view() {
    return page.evaluate(() => {
      const panel = document.querySelector('.mail-inbox-panel'), active = document.activeElement;
      return { ids: [...panel.querySelectorAll('li[data-mail-id]')].map(el => Number(el.dataset.mailId)),
        body: panel.querySelector('[data-role="mail-body"]').textContent,
        focus: active?.getAttribute('data-action') ?? (active?.getAttribute('data-role') === 'mail-open' ? Number(active.closest('li').dataset.mailId) : null),
        checked: panel.querySelector('[data-role="mail-batch-checkbox"]')?.checked ?? false,
        nestedInputs: panel.querySelectorAll('.mail-row-title input').length };
    });
  }
  async function geometry(target, focused = false) {
    const value = await target.evaluate(el => {
      const rect = el.getBoundingClientRect(), style = getComputedStyle(el), hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      const clips = [];
      for (let ancestor = el.parentElement; ancestor; ancestor = ancestor.parentElement) {
        const css = getComputedStyle(ancestor), bounds = ancestor.getBoundingClientRect();
        const x = /auto|scroll|hidden|clip/.test(css.overflowX), y = /auto|scroll|hidden|clip/.test(css.overflowY);
        if (x || y) clips.push({ x, y, left: bounds.left + ancestor.clientLeft, top: bounds.top + ancestor.clientTop,
          right: bounds.left + ancestor.clientLeft + ancestor.clientWidth, bottom: bounds.top + ancestor.clientTop + ancestor.clientHeight });
      }
      const sibling = el.closest('li[data-mail-id]')?.querySelector(el.matches('input') ? '.mail-row-title' : '[data-role="mail-batch-checkbox"]');
      const siblings = sibling ? [sibling.getBoundingClientRect()].map(r => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom })) : [];
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, viewportWidth: innerWidth, viewportHeight: innerHeight,
        clips, siblings, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, hit: hit === el || el.contains(hit),
        active: document.activeElement === el, focusVisible: el.matches(':focus-visible'), outlineWidth: style.outlineWidth, outlineStyle: style.outlineStyle };
    });
    verifyGeometry(value, focused); result.geometry.push(value);
  }
  async function tabTo(target) {
    for (let i = 0; i < 100; i++) {
      await page.keyboard.press('Tab');
      if (await target.evaluate(el => document.activeElement === el)) return;
    }
    assert.fail('native tab target not reachable');
  }
  async function record(name) {
    const label = `mail-${product}-${name}`;
    await screenshot(label); result.screenshots.push(label); result.cases.push(name);
  }
  await step(null, async () => { await action('toggle-mail').click(); });
  verifyView(await view(), { ids: [A.id, B.id, C.id, D.id], body: A.body, checked: false });
  await record('open');
  await step(null, async () => { await action('refresh-mail').click(); });
  await step(null, async () => {
    if (fixed) {
      assert.equal(await title(B.id).evaluate(el => el.tagName), 'BUTTON');
      await tabTo(title(B.id)); await geometry(title(B.id), true);
    } else {
      assert.equal(await page.locator('[data-role="mail-open"]').count(), 0);
      assert.equal(await title(B.id).evaluate(el => el.tagName), 'SPAN');
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press('Tab');
        assert.equal(await title(B.id).evaluate(el => document.activeElement === el), false);
      }
      result.defectObserved = true;
    }
  });
  verifyView(await view(), { ids: [A.id, B.id, C.id, D.id], body: A.body }); await record('tab-b');
  await step(B.id, async () => { if (fixed) await page.keyboard.press('Enter'); else await title(B.id).click(); });
  verifyView(await view(), { ids: [A.id, B.id, C.id, D.id], body: B.body, ...(fixed ? { focus: B.id } : {}) });
  if (fixed) await geometry(title(B.id), true); await record('read-b');
  await step(null, async () => { await tabTo(checkbox); await page.keyboard.press('Space'); });
  verifyView(await view(), { ids: [A.id, B.id, C.id, D.id], body: B.body, checked: true });
  await geometry(checkbox); await record('checkbox');
  await step(null, async () => { await action('mail-filter-unread').click(); });
  verifyView(await view(), { ids: [A.id, C.id, D.id], body: A.body }); await record('unread');
  for (const [current, remaining, focus, key] of [[A, [C.id, D.id], C.id, 'Enter'], [D, [C.id], C.id, 'Space'], [C, [], 'mail-filter-unread', 'Enter']]) {
    await step(null, async () => { if (fixed) await tabTo(title(current.id)); });
    await step(current.id, async () => { if (fixed) await page.keyboard.press(key); else await title(current.id).click(); });
    const next = await view(); verifyView(next, { ids: remaining, body: remaining.length ? C.body : '' });
    if (fixed) {
      assert.equal(next.focus, focus);
      await geometry(typeof focus === 'number' ? title(focus) : action(focus), true);
    }
    await record(`read-${current.label.toLowerCase()}`);
  }
  verifyClassification(result); report.scenario = result;
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { withMailRuntime } = await import('./live_mail_keyboard_runtime.mjs');
  await withMailRuntime(runMailScenario);
}

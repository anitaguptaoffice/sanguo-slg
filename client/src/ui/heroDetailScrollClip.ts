/** HERO-HOST: scroll hero detail bust + name fully inside panel-scroll ∩ clipping ancestors ∩ viewport. */

export const HERO_HOST_SCROLL_CLIP_MARKER = "HERO-HOST-SCROLL-CLIP";

export const HERO_DETAIL_BUST_MIN_CSS_WIDTH = 120;
export const HERO_DETAIL_BUST_MIN_CSS_HEIGHT = 150;

export type AxisRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export function domRectToAxis(rect: DOMRectReadOnly): AxisRect {
  return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
}

export function intersectAxisRects(a: AxisRect, b: AxisRect): AxisRect {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.right, b.right);
  const bottom = Math.min(b.bottom, b.bottom);
  return { left, top, right, bottom };
}

export function axisRectWidth(rect: AxisRect): number {
  return Math.max(0, rect.right - rect.left);
}

export function axisRectHeight(rect: AxisRect): number {
  return Math.max(0, rect.bottom - rect.top);
}

function nodeClipsDescendants(node: Element, style: CSSStyleDeclaration): boolean {
  if (node.classList.contains("panel-scroll-body")) return true;
  if (node.getAttribute("data-role") === "hero-scroll") return true;
  const vals = [style.overflow, style.overflowX, style.overflowY];
  return vals.some((v) => v === "hidden" || v === "clip");
}

/** Viewport plus every overflow/clip ancestor border box (document order root → leaf). */
export function collectClippingAncestorRects(el: Element | null): AxisRect[] {
  const clips: AxisRect[] = [
    { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight },
  ];
  let node: Element | null = el;
  while (node) {
    const style = getComputedStyle(node);
    if (nodeClipsDescendants(node, style)) {
      clips.push(domRectToAxis(node.getBoundingClientRect()));
    }
    node = node.parentElement;
  }
  return clips;
}

export function visibleClipIntersectionForElement(el: Element): AxisRect {
  const base = domRectToAxis(el.getBoundingClientRect());
  let out = base;
  for (const clip of collectClippingAncestorRects(el)) {
    out = intersectAxisRects(out, clip);
  }
  return out;
}

export function axisRectFullyContains(inner: AxisRect, outer: AxisRect, eps = 1): boolean {
  return (
    inner.left >= outer.left - eps &&
    inner.top >= outer.top - eps &&
    inner.right <= outer.right + eps &&
    inner.bottom <= outer.bottom + eps
  );
}

export function unionAxisRects(a: AxisRect, b: AxisRect): AxisRect {
  return {
    left: Math.min(a.left, b.left),
    top: Math.min(a.top, b.top),
    right: Math.max(a.right, b.right),
    bottom: Math.max(a.bottom, b.bottom),
  };
}

export function effectiveVisibleClipForTargets(targets: Element[]): AxisRect | null {
  if (!targets.length) return null;
  const clips = collectClippingAncestorRects(targets[0]);
  let clip = clips[0];
  for (let i = 1; i < clips.length; i++) {
    clip = intersectAxisRects(clip, clips[i]!);
  }
  return clip;
}

export function rectsFullyVisibleInClip(
  rects: AxisRect[],
  clip: AxisRect,
  eps = 1,
): boolean {
  return rects.every((r) => axisRectWidth(r) > 0 && axisRectHeight(r) > 0 && axisRectFullyContains(r, clip, eps));
}

function resetHeroPanelOuterScroll(panel: HTMLElement): void {
  panel.scrollTop = 0;
  panel.scrollLeft = 0;
}

function clampScrollTop(scroll: HTMLElement, top: number): number {
  const max = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
  return Math.max(0, Math.min(top, max));
}

function elementTopInScrollContainer(scroll: HTMLElement, el: Element): number {
  const er = el.getBoundingClientRect();
  const sr = scroll.getBoundingClientRect();
  return er.top - sr.top + scroll.scrollTop;
}

/**
 * Adjust `hero-scroll` scrollTop so bust (128×160) and detail name sit inside the visible clip chain.
 * No-op when elements are missing or already aligned.
 */
export function ensureHeroDetailBustNameInScrollClip(
  heroPanel: ParentNode | null | undefined,
  marginPx = 4,
): void {
  const panel = heroPanel instanceof HTMLElement ? heroPanel : null;
  if (!panel) return;
  resetHeroPanelOuterScroll(panel);
  const scroll = panel.querySelector<HTMLElement>('[data-role="hero-scroll"]');
  const bust = panel.querySelector<HTMLElement>('[data-role="hero-detail-bust"]');
  const name = panel.querySelector<HTMLElement>(".hero-detail-name");
  if (!scroll || !bust) return;

  const targets = name ? [bust, name] : [bust];
  const marginPxClamped = marginPx;
  const scrollRect = scroll.getBoundingClientRect();
  const bustRect0 = bust.getBoundingClientRect();
  scroll.scrollTop += bustRect0.top - scrollRect.top - marginPxClamped;
  for (let pass = 0; pass < 28; pass++) {
    const clip = effectiveVisibleClipForTargets([scroll]);
    if (!clip || axisRectWidth(clip) < 1 || axisRectHeight(clip) < 1) break;

    const rects = targets.map((el) => domRectToAxis(el.getBoundingClientRect()));
    const paddedClip: AxisRect = {
      left: clip.left + marginPx,
      top: clip.top + marginPx,
      right: clip.right - marginPx,
      bottom: clip.bottom - marginPx,
    };
    if (rectsFullyVisibleInClip(rects, paddedClip, 0.5)) return;

    let delta = 0;
    for (const r of rects) {
      if (r.top < paddedClip.top) delta -= paddedClip.top - r.top;
      if (r.bottom > paddedClip.bottom) delta += r.bottom - paddedClip.bottom;
    }
    if (Math.abs(delta) < 0.25) break;
    scroll.scrollTop += delta;
  }
}

/** Scroll hero-scroll so `.hero-detail-hint` (detail footer) sits fully inside the visible clip chain. */
export function ensureHeroDetailFooterInScrollClip(
  heroPanel: ParentNode | null | undefined,
  marginPx = 4,
): void {
  const panel = heroPanel instanceof HTMLElement ? heroPanel : null;
  if (!panel) return;
  resetHeroPanelOuterScroll(panel);
  const scroll = panel.querySelector<HTMLElement>('[data-role="hero-scroll"]');
  const hint = panel.querySelector<HTMLElement>(".hero-detail-hint");
  if (!scroll || !hint) return;

  scroll.scrollTop = scroll.scrollHeight;
  for (let pass = 0; pass < 48; pass++) {
    const clip = effectiveVisibleClipForTargets([scroll]);
    if (!clip || axisRectHeight(clip) < 1) break;
    const padded: AxisRect = {
      left: clip.left + marginPx,
      top: clip.top + marginPx,
      right: clip.right - marginPx,
      bottom: clip.bottom - marginPx,
    };
    const hr = domRectToAxis(hint.getBoundingClientRect());
    if (axisRectHeight(hr) > 0 && axisRectFullyContains(hr, padded, 1)) return;
    if (hr.bottom > padded.bottom) scroll.scrollTop += hr.bottom - padded.bottom + 4;
    else if (hr.top < padded.top) scroll.scrollTop -= padded.top - hr.top + 4;
    else break;
    scroll.scrollTop = clampScrollTop(scroll, scroll.scrollTop);
  }
}

/**
 * Scroll hero-scroll so the selected roster row's round avatar + primary name are fully clip-visible.
 * Used after detail load on narrow hosts where captive/persuade/coming chrome consumes flex budget.
 */
export function ensureHeroListRowAvatarNameInScrollClip(
  heroPanel: ParentNode | null | undefined,
  templateCfgId: number,
  marginPx = 6,
): void {
  const panel = heroPanel instanceof HTMLElement ? heroPanel : null;
  if (!panel || templateCfgId <= 0) return;
  resetHeroPanelOuterScroll(panel);
  const scroll = panel.querySelector<HTMLElement>('[data-role="hero-scroll"]');
  const listRow = panel.querySelector<HTMLElement>(
    `.hero-list li[data-template-cfg-id="${templateCfgId}"].selected, .hero-list li[data-template-cfg-id="${templateCfgId}"][aria-selected="true"], .hero-list li[data-template-cfg-id="${templateCfgId}"]`,
  );
  if (!scroll || !listRow) return;
  const avatar = listRow.querySelector<HTMLElement>('[data-role="hero-list-avatar"]');
  const nameEl = listRow.querySelector<HTMLElement>(".hero-list-row-primary");
  if (!avatar) return;
  const targets = nameEl ? [avatar, nameEl] : [avatar];

  scroll.scrollTop = clampScrollTop(scroll, elementTopInScrollContainer(scroll, listRow) - 80);
  for (let pass = 0; pass < 64; pass++) {
    let clip = effectiveVisibleClipForTargets([listRow]);
    if (!clip || axisRectHeight(clip) < 8) {
      const scrollRect = scroll.getBoundingClientRect();
      const avatarRect = avatar.getBoundingClientRect();
      scroll.scrollTop = clampScrollTop(
        scroll,
        scroll.scrollTop + avatarRect.top - scrollRect.top - 80,
      );
      clip = effectiveVisibleClipForTargets([listRow]);
    }
    if (!clip || axisRectHeight(clip) < 1) break;
    const padded: AxisRect = {
      left: clip.left + marginPx,
      top: clip.top + marginPx,
      right: clip.right - marginPx,
      bottom: clip.bottom - marginPx,
    };
    if (axisRectHeight(padded) < 5) {
      scroll.scrollTop = clampScrollTop(scroll, elementTopInScrollContainer(scroll, avatar) - 80);
      continue;
    }
    const rects = targets.map((el) => domRectToAxis(el.getBoundingClientRect()));
    if (rectsFullyVisibleInClip(rects, padded, 0.5)) return;

    let delta = 0;
    for (const r of rects) {
      if (r.top < padded.top) delta -= padded.top - r.top;
      if (r.bottom > padded.bottom) delta += r.bottom - padded.bottom;
    }
    if (Math.abs(delta) < 0.25) break;
    scroll.scrollTop = clampScrollTop(scroll, scroll.scrollTop + delta);
  }
}

// Serialized into the page. Every operation below observes; no input or DOM writes.
export function installRadioCollector({ panelSelector, maxEvents = 256 }) {
  if (!Number.isSafeInteger(maxEvents) || maxEvents < 1 || maxEvents > 2048) throw Error('Invalid event budget');
  const root = document.querySelector(panelSelector);
  if (!root) throw Error('Missing observed panel');
  const selector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const ids = new WeakMap(), nodes = new Map(), pendingEvents = new Map(), events = [];
  let nextId = 1, overflow = false, disposed = false, failure = null;
  const identity = node => {
    if (!node) return null;
    if (!ids.has(node)) {
      if (nodes.size >= 2048) { overflow = true; return -1; }
      ids.set(node, nextId++); nodes.set(ids.get(node), node);
    }
    return ids.get(node);
  };
  const clock = () => ({ at: Date.now(), mono: performance.now() });
  const style = node => {
    const css = getComputedStyle(node);
    return { hidden: !!node.hidden, inert: !!node.inert, ariaHidden: node.getAttribute('aria-hidden'), display: css.display, visibility: css.visibility, open: node.tagName === 'DETAILS' ? node.open : null };
  };
  const describe = node => {
    if (!(node instanceof Element)) return null;
    const r = node.getBoundingClientRect(), ancestors = [];
    for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) ancestors.push({ id: identity(ancestor), tag: ancestor.tagName, ...style(ancestor), inSummary: ancestor.tagName === 'DETAILS' ? !!ancestor.querySelector(':scope > summary')?.contains(node) : null });
    return { id: identity(node), tag: node.tagName, type: node.type || '', name: node.getAttribute('name') || '', value: 'value' in node ? String(node.value) : '',
      checked: !!node.checked, disabled: !!node.disabled, effectiveDisabled: node.matches(':disabled'), tabIndex: node.tabIndex, tabIndexAttribute: node.getAttribute('tabindex'), formId: identity(node.form), scopeId: identity(node.getRootNode()),
      connected: node.isConnected, inPanel: root.contains(node), rect: { x: r.x, y: r.y, width: r.width, height: r.height }, own: style(node), ancestors };
  };
  const finalize = () => {
    if (disposed) return;
    for (const [row, event] of pendingEvents) if (event.eventPhase === 0) {
      row.final = { ...clock(), phase: event.eventPhase, prevented: event.defaultPrevented, active: describe(document.activeElement), boundary: readSnapshot(row.active.id) };
      pendingEvents.delete(row);
    }
  };
  const sameGroup = (a, b) => a.type === 'radio' && b.type === 'radio' && a.name && a.name === b.name && a.formId === b.formId && a.scopeId === b.scopeId;
  const readSnapshot = (heldId = null) => {
    if (disposed) throw Error('Observer disposed');
    const candidates = [...root.querySelectorAll(selector)].filter(node => {
      const css = getComputedStyle(node); return node.getAttribute('aria-hidden') !== 'true' && css.display !== 'none' && css.visibility !== 'hidden';
    }).map(describe);
    const eligible = candidates.filter(node => node.type !== 'radio' || node.tabIndex >= 0 && !node.effectiveDisabled && [node.own, ...node.ancestors].every(s => !s.hidden && !s.inert && s.display !== 'none' && (s.open !== false || s.inSummary === true)));
    const intendedIds = eligible.filter(node => {
      if (node.type !== 'radio' || !node.name) return true;
      const group = eligible.filter(other => sameGroup(node, other));
      return node.id === (group.find(other => other.checked) || group[0]).id;
    }).map(node => node.id);
    return { schema: 2, ...clock(), rootId: identity(root), active: describe(document.activeElement), held: describe(nodes.get(heldId)), candidates, eligibleIds: eligible.map(node => node.id), intendedIds,
      radios: [...root.getRootNode().querySelectorAll('input[type="radio"]')].map(describe), submit: describe(root.querySelector('[data-action="hero-largess-submit"]')), details: [...root.querySelectorAll('details')].map(node => ({ id: identity(node), open: node.open })), overflow, failure };
  };
  const snapshot = heldId => {
    if (disposed) throw Error('Observer disposed');
    try { finalize(); return readSnapshot(heldId); }
    catch (error) { failure = String(error); dispose(); throw error; }
  };
  const observe = event => {
    if (disposed) return;
    if (events.length >= maxEvents) { overflow = true; return; }
    const row = { id: events.length + 1, type: event.type, phase: event.eventPhase, ...clock(), trusted: event.isTrusted, target: describe(event.target), active: describe(document.activeElement), related: describe(event.relatedTarget) };
    events.push(row);
    if (event.type === 'keydown') {
      Object.assign(row, { key: event.key, code: event.code, shift: event.shiftKey, alt: event.altKey, ctrl: event.ctrlKey, meta: event.metaKey, initialPrevented: event.defaultPrevented, captureCheckpoint: null, final: null });
      row.boundary = readSnapshot(row.active.id);
      pendingEvents.set(row, event);
      queueMicrotask(() => {
        if (disposed) return;
        try { row.captureCheckpoint = { ...clock(), phase: event.eventPhase, prevented: event.defaultPrevented, active: describe(document.activeElement) }; }
        catch (error) { failure = String(error); dispose(); }
      });
    }
  };
  const types = ['keydown', 'focusin', 'focusout', 'input', 'change'];
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    types.forEach(type => window.removeEventListener(type, listen, true));
    nodes.clear(); pendingEvents.clear();
  };
  const listen = event => {
    try { observe(event); } catch (error) { failure = String(error); dispose(); }
  };
  types.forEach(type => window.addEventListener(type, listen, true));
  return { snapshot, readEvents: () => {
    try { finalize(); } catch (error) { failure = String(error); dispose(); }
    return { schema: 2, events: structuredClone(events), overflow, failure };
  }, dispose };
}

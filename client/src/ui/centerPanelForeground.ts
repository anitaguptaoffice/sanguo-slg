/** One foreground content surface per mount. Dialogs/tooltips are not panel peers. */
const triggers = new WeakMap<HTMLElement, HTMLElement>();
const epochs = new WeakMap<HTMLElement, number>();
const bound = new WeakSet<HTMLElement>();
const peerSelector = ".content-panel, .military-panel, .building-panel";
function bump(root: HTMLElement): void {
  const mount = root.parentElement;
  if (mount) epochs.set(mount, (epochs.get(mount) ?? 0) + 1);
}

/** Capture before an RPC; a later navigation (including away and back) cancels presentation only. */
export function captureCenterPanelIntent(root: HTMLElement): () => boolean {
  const mount = root.parentElement;
  const epoch = mount ? epochs.get(mount) : undefined;
  return () => root.parentElement === mount && !root.classList.contains("hidden")
    && (!mount || epochs.get(mount) === epoch);
}

export function openCenterPanel(root: HTMLElement): void {
  bump(root);
  const active = root.ownerDocument.activeElement;
  if (active instanceof HTMLElement && !root.contains(active)) triggers.set(root, active);
  for (const peer of Array.from(root.parentElement?.children ?? [])) {
    if (peer !== root && peer instanceof HTMLElement && peer.matches(peerSelector) && !peer.classList.contains("hidden")) {
      peer.dispatchEvent(new Event("center-panel-suspend"));
      peer.classList.add("hidden");
    }
  }
  root.classList.remove("hidden");
  if (!bound.has(root)) {
    bound.add(root);
    root.addEventListener("keydown", (event) => {
      // Modal handlers own their Escape; never intercept events outside this surface.
      if (event.key === "Escape" && !event.defaultPrevented && !(event.target as Element).closest('[role="dialog"], [role="alertdialog"]')) {
        event.preventDefault();
        toggleCenterPanel(root);
      }
    });
  }
  // Let synchronous render finish. Late responses never call this presentation boundary.
  queueMicrotask(() => {
    if (!root.isConnected || root.classList.contains("hidden") || root.contains(root.ownerDocument.activeElement)) return;
    const first = Array.from(root.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, [tabindex='0']"))
      .find(el => !el.closest(".hidden, [hidden]") && getComputedStyle(el).display !== "none");
    if (!first) root.tabIndex = -1;
    (first ?? root).focus({ preventScroll: true });
  });
}

export function toggleCenterPanel(root: HTMLElement): void {
  if (root.classList.contains("hidden")) { openCenterPanel(root); return; }
  bump(root);
  root.dispatchEvent(new Event("center-panel-suspend"));
  root.classList.add("hidden");
  const trigger = triggers.get(root);
  if (trigger?.isConnected && !trigger.closest(".hidden, [hidden]")) trigger.focus({ preventScroll: true });
}

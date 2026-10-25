import {
  buildBuildQueueSlotMatrix,
  buildQueueMatrixIndexForSlot,
} from "@/net/buildQueueMatrix";
import type { MainCitySession } from "@/net/bootstrapSession";
import {
  DOMESTIC_SLOT_STRIP_CELL_CLASS,
  DOMESTIC_SLOT_STRIP_SELECTOR,
} from "@/net/domesticSlotScrollAnchor";

const STRIP_INNER_CLASS = "main-city-slot-overlay-inner";

export class MainCityDomesticSlotStrip {
  private root!: HTMLElement;
  private readonly buttons = new Map<string, HTMLButtonElement>();
  private selectedSlotKey: string | null = null;

  constructor(
    private readonly mount: HTMLElement,
    private readonly slotLabels: Record<string, string>,
    private readonly getSession: () => MainCitySession | null,
    private readonly onSlotSelect: (slotKey: string) => void,
  ) {}

  attach(): void {
    if (this.root?.parentNode) return;
    this.buttons.clear();
    this.root = document.createElement("div");
    this.root.className = "main-city-slot-overlay-wrap";
    this.root.innerHTML = `<div class="${DOMESTIC_SLOT_STRIP_SELECTOR.slice(1)}" data-role="main-city-slot-overlay" aria-label="七槽快捷条"></div>`;
    this.root.querySelector(DOMESTIC_SLOT_STRIP_SELECTOR)?.addEventListener("click", (ev) =>
      this.onClick(ev),
    );
    this.mount.appendChild(this.root);
    this.render();
  }

  detach(): void {
    this.root?.remove();
    this.buttons.clear();
  }

  getStripRoot(): HTMLElement {
    return this.root;
  }

  setSelectedSlotKey(slotKey: string | null): void {
    this.selectedSlotKey = slotKey?.trim() || null;
    this.render();
  }

  getSelectedSlotKey(): string | null {
    return this.selectedSlotKey;
  }

  sync(): void {
    this.render();
  }

  private render(): void {
    const scrollHost = this.root?.querySelector(DOMESTIC_SLOT_STRIP_SELECTOR);
    if (!(scrollHost instanceof HTMLElement)) return;
    const session = this.getSession();
    const now = Date.now();
    const cells = buildBuildQueueSlotMatrix(
      session?.buildings,
      session?.wallet,
      this.slotLabels,
      now,
    );
    let inner = scrollHost.querySelector<HTMLElement>(`.${STRIP_INNER_CLASS}`);
    if (!inner) {
      inner = document.createElement("div");
      inner.className = STRIP_INNER_CLASS;
      scrollHost.appendChild(inner);
    }
    const liveKeys = new Set(cells.map((cell) => cell.slotKey));
    for (const [key, button] of this.buttons) {
      if (!liveKeys.has(key)) {
        button.remove();
        this.buttons.delete(key);
      }
    }
    for (const [index, cell] of cells.entries()) {
      let btn = this.buttons.get(cell.slotKey);
      if (!btn) {
        btn = document.createElement("button");
        btn.type = "button";
        btn.className = DOMESTIC_SLOT_STRIP_CELL_CLASS;
        btn.dataset.slotKey = cell.slotKey;
        this.buttons.set(cell.slotKey, btn);
      }
      // Do not move unchanged nodes: removing/reinserting a focused button blurs it.
      if (inner.children[index] !== btn) inner.insertBefore(btn, inner.children[index] ?? null);
      if (btn.dataset.slotIndex !== String(cell.matrixIndex)) btn.dataset.slotIndex = String(cell.matrixIndex);
      if (btn.dataset.status !== cell.status) btn.dataset.status = cell.status;
      if (btn.title !== cell.title) btn.title = cell.title;
      if (btn.getAttribute("aria-label") !== cell.title) btn.setAttribute("aria-label", cell.title);
      if (btn.textContent !== cell.abbrev) btn.textContent = cell.abbrev;
      btn.classList.toggle("main-city-slot-overlay-cell-selected", this.selectedSlotKey === cell.slotKey);
    }
  }

  private onClick(ev: Event): void {
    if (!(ev.target instanceof Element)) return;
    const btn = ev.target.closest<HTMLButtonElement>(
      `.${DOMESTIC_SLOT_STRIP_CELL_CLASS}`,
    );
    if (!btn || btn.disabled || !this.root.contains(btn)) return;
    const slotKey = btn.dataset.slotKey?.trim();
    if (!slotKey) return;
    this.selectedSlotKey = slotKey;
    this.render();
    this.onSlotSelect(slotKey);
  }

  /** 读取当前选中槽在矩阵中的 index（供 session 写入）。 */
  selectedMatrixIndex(): number | null {
    if (!this.selectedSlotKey) return null;
    return buildQueueMatrixIndexForSlot(this.selectedSlotKey);
  }
}

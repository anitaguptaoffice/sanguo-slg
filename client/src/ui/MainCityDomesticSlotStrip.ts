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
  private selectedSlotKey: string | null = null;

  constructor(
    private readonly mount: HTMLElement,
    private readonly slotLabels: Record<string, string>,
    private readonly getSession: () => MainCitySession | null,
    private readonly onSlotSelect: (slotKey: string) => void,
  ) {}

  attach(): void {
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
    scrollHost.replaceChildren();
    const inner = document.createElement("div");
    inner.className = STRIP_INNER_CLASS;
    for (const cell of cells) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = DOMESTIC_SLOT_STRIP_CELL_CLASS;
      btn.dataset.slotKey = cell.slotKey;
      btn.dataset.slotIndex = String(cell.matrixIndex);
      btn.dataset.status = cell.status;
      btn.title = cell.title;
      btn.setAttribute("aria-label", cell.title);
      btn.textContent = cell.abbrev;
      if (this.selectedSlotKey === cell.slotKey) {
        btn.classList.add("main-city-slot-overlay-cell-selected");
      }
      inner.appendChild(btn);
    }
    scrollHost.appendChild(inner);
  }

  private onClick(ev: Event): void {
    const btn = (ev.target as HTMLElement).closest<HTMLElement>(
      `.${DOMESTIC_SLOT_STRIP_CELL_CLASS}`,
    );
    const slotKey = btn?.dataset.slotKey?.trim();
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

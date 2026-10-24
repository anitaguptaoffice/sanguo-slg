import type { HeroSummary } from "@/net/heroMailState";
import {
  CITY_CHIEF_MARCH_BLOCK_MESSAGE,
  type CityChiefSubmitPhase,
  type CityChiefView,
  cityChiefAppointButtonDisabled,
  cityChiefClearButtonDisabled,
  formatCityChiefCurrentLine,
  formatCityChiefHeroOptionLabel,
  formatCityChiefProductionBonusStub,
  isHeroBlockedForCityChief,
} from "@/net/cityChiefOffice";

export type MainCityCityOfficePanelHandlers = {
  onAppoint: (heroId: number) => void;
  onClear: () => void;
};

export class MainCityCityOfficePanel {
  private section!: HTMLElement;
  private phase: CityChiefSubmitPhase = "idle";
  private chief: CityChiefView | null = null;
  private heroes: HeroSummary[] = [];
  private marchingHeroIds = new Set<number>();

  constructor(private readonly handlers: MainCityCityOfficePanelHandlers) {}

  mountInto(buildingPanelRoot: HTMLElement): void {
    const scroll = buildingPanelRoot.querySelector('[data-role="building-scroll"]');
    if (!scroll) return;
    this.section = document.createElement("div");
    this.section.className = "city-office-section hidden";
    this.section.dataset.role = "city-office-section";
    this.section.innerHTML =
      '<h4 class="city-office-title">城主</h4>' +
      '<p data-role="city-chief-current"></p><p data-role="city-chief-bonus-stub"></p>' +
      '<label>任命将领 <select data-role="city-chief-hero-select"></select></label>' +
      '<div class="city-chief-actions">' +
      '<button type="button" class="art-btn-primary" data-action="appoint-chief">任命城主</button>' +
      '<button type="button" class="art-btn-secondary" data-action="clear-chief">卸任城主</button></div>' +
      '<p class="march-form-error-sibling hidden" data-role="city-chief-form-error" role="alert"></p>';
    scroll.insertBefore(this.section, scroll.firstChild);
    this.section.addEventListener("click", (ev) => this.onClick(ev));
    this.section.addEventListener("change", () => this.setFormError(null));
    this.render();
  }

  setVisibleForHallSlot(slotKey: string | null): void {
    if (!this.section) return;
    const show = slotKey === "hall";
    this.section.classList.toggle("hidden", !show);
    if (!show) this.setFormError(null);
  }

  setPhase(phase: CityChiefSubmitPhase): void {
    this.phase = phase;
    this.render();
  }

  setChiefView(view: CityChiefView | null): void {
    this.chief = view;
    this.render();
  }

  setHeroes(heroes: HeroSummary[]): void {
    this.heroes = heroes;
    this.render();
  }

  setMarchingHeroIds(ids: ReadonlySet<number>): void {
    this.marchingHeroIds = new Set(ids);
    this.render();
  }

  setFormError(message: string | null): void {
    const el = this.section?.querySelector('[data-role="city-chief-form-error"]');
    if (!el) return;
    el.textContent = message?.trim() ?? "";
    el.classList.toggle("hidden", !message?.trim());
  }

  getSelectedHeroId(): number {
    const sel = this.section?.querySelector<HTMLSelectElement>('[data-role="city-chief-hero-select"]');
    return Number(sel?.value ?? 0) || 0;
  }

  private onClick(ev: Event): void {
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn || btn.disabled) return;
    if (btn.getAttribute("data-action") === "appoint-chief") {
      const heroId = this.getSelectedHeroId();
      if (isHeroBlockedForCityChief(heroId, this.marchingHeroIds)) {
        this.setFormError(CITY_CHIEF_MARCH_BLOCK_MESSAGE);
        return;
      }
      this.handlers.onAppoint(heroId);
      return;
    }
    if (btn.getAttribute("data-action") === "clear-chief") this.handlers.onClear();
  }

  private render(): void {
    if (!this.section || this.section.classList.contains("hidden")) return;
    const currentEl = this.section.querySelector('[data-role="city-chief-current"]');
    const bonusEl = this.section.querySelector('[data-role="city-chief-bonus-stub"]');
    const sel = this.section.querySelector<HTMLSelectElement>('[data-role="city-chief-hero-select"]');
    const appointBtn = this.section.querySelector<HTMLButtonElement>('[data-action="appoint-chief"]');
    const clearBtn = this.section.querySelector<HTMLButtonElement>('[data-action="clear-chief"]');
    if (!currentEl || !bonusEl || !sel || !appointBtn || !clearBtn) return;

    if (this.phase === "loading") {
      currentEl.textContent = "城主信息加载中…";
      bonusEl.textContent = "";
      sel.disabled = appointBtn.disabled = clearBtn.disabled = true;
      return;
    }

    currentEl.textContent = formatCityChiefCurrentLine(this.chief, this.heroes);
    bonusEl.textContent = formatCityChiefProductionBonusStub(this.chief);
    const prev = sel.value;
    sel.innerHTML = "";
    sel.disabled = this.phase !== "idle";
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = this.heroes.length ? "选择将领" : "暂无将领";
    sel.appendChild(ph);
    for (const h of this.heroes) {
      const id = h.hero_id ?? 0;
      if (id <= 0) continue;
      const opt = document.createElement("option");
      opt.value = String(id);
      const blocked = isHeroBlockedForCityChief(id, this.marchingHeroIds);
      opt.textContent = formatCityChiefHeroOptionLabel(h) + (blocked ? " · 出征中" : "");
      opt.disabled = blocked;
      sel.appendChild(opt);
    }
    const chiefId = this.chief?.hero_id ?? 0;
    if (chiefId > 0 && [...sel.options].some((o) => o.value === String(chiefId))) sel.value = String(chiefId);
    else if (prev && [...sel.options].some((o) => o.value === prev)) sel.value = prev;

    const selectedId = this.getSelectedHeroId();
    appointBtn.disabled = cityChiefAppointButtonDisabled(this.phase, selectedId, this.marchingHeroIds);
    clearBtn.disabled = cityChiefClearButtonDisabled(this.phase, this.chief);
    appointBtn.textContent = this.phase === "appointing" ? "任命中…" : "任命城主";
    clearBtn.textContent = this.phase === "clearing" ? "卸任中…" : "卸任城主";
  }
}

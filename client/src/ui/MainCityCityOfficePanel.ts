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

export type CityCivicView = {
  name?: string;
  population?: number;
  population_cap?: number;
  morale?: number;
  tax_rate?: number;
  work_rate?: number;
  effective_work_rate?: number;
  idle_population?: number;
  troops?: number;
  food_upkeep_per_hour?: number;
  gold_per_hour?: number;
  gold?: number;
};

export type MainCityCityOfficePanelHandlers = {
  onAppoint: (heroId: number) => void;
  onClear: () => void;
  onCivicDecree?: (decree: number, value: number, name: string) => void;
};

export class MainCityCityOfficePanel {
  private section!: HTMLElement;
  private selectionTouched = false;
  private phase: CityChiefSubmitPhase = "idle";
  private chief: CityChiefView | null = null;
  private civic: CityCivicView | null = null;
  private heroes: HeroSummary[] = [];
  private marchingHeroIds = new Set<number>();

  constructor(private readonly handlers: MainCityCityOfficePanelHandlers) {}

  mountInto(buildingPanelRoot: HTMLElement): void {
    this.selectionTouched = false;
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
      '<p class="march-form-error-sibling hidden" data-role="city-chief-form-error" role="alert"></p>' +
      '<div class="city-civic-section" data-role="city-civic-section">' +
      '<h4 class="city-office-title">民政</h4>' +
      '<p data-role="city-civic-line">人口与民心加载中…</p>' +
      '<p data-role="city-civic-rates"></p>' +
      '<div class="city-civic-actions">' +
      '<label>税率 <input type="number" min="0" max="30" step="1" data-field="civic-tax" /></label>' +
      '<button type="button" data-action="decree-tax">调整税率</button>' +
      '<label>开工率 <input type="number" min="20" max="100" step="1" data-field="civic-work" /></label>' +
      '<button type="button" data-action="decree-work">调整开工率</button>' +
      '<button type="button" data-action="decree-pacify">安抚百姓</button>' +
      '<button type="button" data-action="decree-levy">征收物资</button>' +
      '<label>城名 <input type="text" maxlength="16" data-field="civic-name" /></label>' +
      '<button type="button" data-action="decree-rename">城池改名</button>' +
      '</div></div>';
    const civicActions = this.section.querySelector<HTMLElement>(".city-civic-actions");
    if (civicActions) {
      civicActions.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px";
      civicActions.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
        input.style.width = input.type === "number" ? "64px" : "96px";
      });
    }
    scroll.insertBefore(this.section, scroll.firstChild);
    this.section.addEventListener("click", (ev) => this.onClick(ev));
    this.section.addEventListener("change", (ev) => {
      const select = ev.target as HTMLSelectElement;
      if (select.dataset.role !== "city-chief-hero-select" || select.disabled) return;
      this.selectionTouched = true;
      this.setFormError(null);
      this.render();
    });
    this.render();
  }

  setVisibleForHallSlot(slotKey: string | null): void {
    if (!this.section) return;
    const show = slotKey === "hall";
    this.section.classList.toggle("hidden", !show);
    if (!show) this.setFormError(null);
    else this.render();
  }

  setPhase(phase: CityChiefSubmitPhase): void {
    this.phase = phase;
    this.render();
  }

  setCivicView(view: CityCivicView | null): void {
    this.civic = view;
    this.renderCivic();
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
    const decree = {
      "decree-tax": 1,
      "decree-work": 2,
      "decree-pacify": 3,
      "decree-levy": 4,
      "decree-rename": 5,
    }[btn.getAttribute("data-action") ?? ""];
    if (decree && this.handlers.onCivicDecree) {
      const tax = Number(this.section.querySelector<HTMLInputElement>('[data-field="civic-tax"]')?.value ?? 0);
      const work = Number(this.section.querySelector<HTMLInputElement>('[data-field="civic-work"]')?.value ?? 0);
      const name = this.section.querySelector<HTMLInputElement>('[data-field="civic-name"]')?.value ?? "";
      this.handlers.onCivicDecree(decree, decree === 1 ? tax : decree === 2 ? work : 0, name);
    }
  }

  private renderCivic(): void {
    if (!this.section) return;
    const line = this.section.querySelector('[data-role="city-civic-line"]');
    const rates = this.section.querySelector('[data-role="city-civic-rates"]');
    if (!line || !rates) return;
    const v = this.civic;
    if (!v) {
      line.textContent = "人口与民心加载中…";
      rates.textContent = "";
      return;
    }
    line.textContent = `${v.name || "主城"} · 人口 ${formatNumber(v.population)}/${formatNumber(v.population_cap)}` +
      ` · 民心 ${v.morale ?? 0} · 空闲人口 ${formatNumber(v.idle_population)}`;
    rates.textContent = `税率 ${v.tax_rate ?? 0}% · 开工率 ${v.work_rate ?? 0}%（实际 ${v.effective_work_rate ?? 0}%）` +
      ` · 驻军 ${formatNumber(v.troops)} · 耗粮 ${formatNumber(v.food_upkeep_per_hour)}/h` +
      ` · 税金 ${formatNumber(v.gold_per_hour)}/h · 黄金 ${formatNumber(v.gold)}`;
    const tax = this.section.querySelector<HTMLInputElement>('[data-field="civic-tax"]');
    const work = this.section.querySelector<HTMLInputElement>('[data-field="civic-work"]');
    const name = this.section.querySelector<HTMLInputElement>('[data-field="civic-name"]');
    if (tax && document.activeElement !== tax) tax.value = String(v.tax_rate ?? 0);
    if (work && document.activeElement !== work) work.value = String(v.work_rate ?? 0);
    if (name && document.activeElement !== name && !name.value) name.value = v.name ?? "";
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

    currentEl.textContent = this.phase === "uncertain"
      ? (this.chief ? `${formatCityChiefCurrentLine(this.chief, this.heroes)}（上次记录，待核实）` : "城主状态待核实")
      : formatCityChiefCurrentLine(this.chief, this.heroes);
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
    if (this.selectionTouched) {
      sel.value = [...sel.options].some((o) => o.value === prev) ? prev : "";
    } else if (chiefId > 0 && [...sel.options].some((o) => o.value === String(chiefId))) {
      sel.value = String(chiefId);
    }

    const selectedId = this.getSelectedHeroId();
    appointBtn.disabled = cityChiefAppointButtonDisabled(this.phase, selectedId, this.marchingHeroIds);
    clearBtn.disabled = cityChiefClearButtonDisabled(this.phase, this.chief);
    appointBtn.textContent = this.phase === "appointing" ? "任命中…" : "任命城主";
    clearBtn.textContent = this.phase === "clearing" ? "卸任中…" : "卸任城主";
  }
}

function formatNumber(value: number | undefined): string {
  return Number(value ?? 0).toLocaleString("zh-CN");
}

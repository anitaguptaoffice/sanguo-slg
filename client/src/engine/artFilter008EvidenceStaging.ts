import type { AssetLoader } from "@/engine/AssetLoader";
import {
  applyFilterChipVisualState,
  mountFilterChip,
  mountFilterRow,
  type FilterChipVisualState,
  type FilterRowVisualState,
} from "@/engine/artUiFilterSkin";

declare global {
  interface Window {
    __artFilter008Evidence?: {
      stageChipStates: (container: HTMLElement, states: FilterChipVisualState[]) => void;
      stageRowStates: (container: HTMLElement, states: FilterRowVisualState[]) => void;
    };
  }
}

/** DEV-only hooks for Playwright runtime evidence (CLIENT-137). */
export function registerArtFilter008EvidenceHooks(assets: AssetLoader): void {
  if (!import.meta.env.DEV) return;
  window.__artFilter008Evidence = {
    stageChipStates(container, states) {
      container.innerHTML = "";
      container.classList.add("art-filter-chip-evidence-staging");
      for (const state of states) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.uiFilterChip = "";
        btn.classList.add("mail-filter-btn");
        const label = document.createElement("span");
        label.className = "art-filter-chip-label";
        label.textContent = state;
        btn.appendChild(label);
        container.appendChild(btn);
        mountFilterChip(btn, assets);
        applyFilterChipVisualState(btn, assets, state);
      }
    },
    stageRowStates(container, states) {
      container.innerHTML = "";
      container.classList.add("art-filter-row-evidence-staging");
      const ul = document.createElement("ul");
      ul.className = "mail-list art-filter-row-evidence-list";
      ul.style.maxHeight = "none";
      ul.style.overflow = "visible";
      for (const state of states) {
        const li = document.createElement("li");
        li.dataset.uiFilterRow = "";
        const title = document.createElement("span");
        title.className = "mail-row-title";
        const titleText = document.createElement("span");
        titleText.className = "mail-row-title-text";
        titleText.textContent = `行态 ${state}`;
        title.appendChild(titleText);
        const summary = document.createElement("span");
        summary.className = "mail-row-summary";
        summary.textContent = "多行详情在无皮肤区（staging）";
        li.appendChild(title);
        li.appendChild(summary);
        if (state === "selected") li.classList.add("selected");
        if (state === "hover") li.dataset.filterRowState = "hover";
        ul.appendChild(li);
        mountFilterRow(li, assets);
      }
      container.appendChild(ul);
    },
  };
}

import { describe, expect, it, vi } from "vitest";
import {
  HERO_LIST_INFLIGHT_ATTR,
  HERO_LIST_REFRESH_PULSE_CLASS,
  HERO_REFRESH_BUTTON_INFLIGHT_LABEL,
  scheduleHeroListRefreshPulse,
  scrollHeroListRowIntoView,
  setHeroListFormErrorDisplay,
  syncHeroListRefreshedAtDisplay,
  syncHeroListRefreshButton,
} from "@/net/heroListRefreshFeedback";

describe("heroListRefreshFeedback", () => {
  it("scheduleHeroListRefreshPulse toggles hero-list-refresh-pulse", () => {
    const ul = document.createElement("ul");
    vi.useFakeTimers();
    scheduleHeroListRefreshPulse(ul);
    expect(ul.classList.contains(HERO_LIST_REFRESH_PULSE_CLASS)).toBe(true);
    vi.advanceTimersByTime(1200);
    expect(ul.classList.contains(HERO_LIST_REFRESH_PULSE_CLASS)).toBe(false);
    vi.useRealTimers();
  });

  it("syncHeroListRefreshButton disables and labels inflight", () => {
    const root = document.createElement("div");
    root.dataset.centerPanel = "hero";
    root.innerHTML = `<button type="button" data-action="refresh-heroes">刷新列表</button>`;
    syncHeroListRefreshButton(root, true);
    const btn = root.querySelector("button")!;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe(HERO_REFRESH_BUTTON_INFLIGHT_LABEL);
    expect(root.getAttribute(HERO_LIST_INFLIGHT_ATTR)).toBe("1");
    syncHeroListRefreshButton(root, false);
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe("刷新列表");
    expect(root.hasAttribute(HERO_LIST_INFLIGHT_ATTR)).toBe(false);
  });

  it("syncHeroListRefreshedAtDisplay shows formatHeroListRefreshedAt line", () => {
    const root = document.createElement("div");
    root.innerHTML = `<p class="hidden" data-role="hero-list-refreshed-at"></p>`;
    const now = Date.UTC(2026, 0, 15, 12, 0, 0);
    syncHeroListRefreshedAtDisplay(root, now - 30_000, now);
    const el = root.querySelector('[data-role="hero-list-refreshed-at"]')!;
    expect(el.textContent).toBe("列表更新：刚刚");
    expect(el.classList.contains("hidden")).toBe(false);
    syncHeroListRefreshedAtDisplay(root, 0);
    expect(el.classList.contains("hidden")).toBe(true);
  });

  it("scrollHeroListRowIntoView targets hero list row", () => {
    const root = document.createElement("div");
    const row = document.createElement("li");
    row.setAttribute("data-hero-id", "12");
    const scrolled = vi.fn();
    row.scrollIntoView = scrolled;
    root.appendChild(row);
    expect(scrollHeroListRowIntoView(root, 12)).toBe(true);
    expect(scrolled).toHaveBeenCalledWith({ block: "nearest" });
  });

  it("setHeroListFormErrorDisplay shows CLIENT-067 style inline errors", () => {
    const root = document.createElement("div");
    root.innerHTML = `<p class="hidden" data-role="hero-list-form-error"></p>`;
    setHeroListFormErrorDisplay(root, "资源不足 [40001]");
    const el = root.querySelector('[data-role="hero-list-form-error"]')!;
    expect(el.textContent).toBe("资源不足 [40001]");
    expect(el.classList.contains("hidden")).toBe(false);
    setHeroListFormErrorDisplay(root, null);
    expect(el.classList.contains("hidden")).toBe(true);
  });
});

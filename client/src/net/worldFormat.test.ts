import { describe, expect, it } from "vitest";
import {
  applyMarchTargetToForm,
  citiesFromListPlayerCitiesResponse,
  formatCityCoords,
  formatPlayerCityLine,
  isCurrentMainCity,
} from "@/net/worldFormat";

describe("worldFormat", () => {
  it("formats city coordinates", () => {
    expect(formatCityCoords(60, 60)).toBe("(60,60)");
    expect(formatCityCoords(0, 12)).toBe("(0,12)");
    expect(formatCityCoords(undefined, 5)).toBe("(?,5)");
  });

  it("marks current city as 主城 in list line", () => {
    const city = { city_id: 9, name: "洛阳", x: 10, y: 20, is_capital: false };
    expect(formatPlayerCityLine(city, 9)).toBe("洛阳 (10,20) · 主城");
    expect(formatPlayerCityLine(city, 1)).toBe("洛阳 (10,20)");
    expect(formatPlayerCityLine({ city_id: 1, name: "分城", x: 1, y: 2, is_capital: true }, undefined)).toBe(
      "分城 (1,2) · 主城",
    );
  });

  it("parses list response and detects current main city", () => {
    const rows = citiesFromListPlayerCitiesResponse({
      cities: [{ city_id: 2, name: "A", x: 1, y: 1 }],
    });
    expect(rows).toHaveLength(1);
    expect(isCurrentMainCity(rows[0], 2)).toBe(true);
    expect(isCurrentMainCity(rows[0], 3)).toBe(false);
  });

  it("fills march target inputs when form exists", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <input data-field="to-x" value="0" />
      <input data-field="to-y" value="0" />
    `;
    expect(applyMarchTargetToForm(root, 7, 8)).toBe(true);
    expect((root.querySelector('[data-field="to-x"]') as HTMLInputElement).value).toBe("7");
    expect((root.querySelector('[data-field="to-y"]') as HTMLInputElement).value).toBe("8");
    expect(applyMarchTargetToForm(null, 1, 2)).toBe(false);
  });
});

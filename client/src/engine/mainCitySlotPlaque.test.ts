import { describe, expect, it, vi } from "vitest";
import { drawBuiltSlotPlaque, drawUnbuiltSlotFoundation } from "@/engine/mainCitySlotPlaque";

describe("mainCitySlotPlaque", () => {
  it("draws unbuilt foundation without throwing", () => {
    const c2d = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      setLineDash: vi.fn(),
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      fillText: vi.fn(),
      font: "",
      textAlign: "",
      textBaseline: "",
    } as unknown as CanvasRenderingContext2D;
    drawUnbuiltSlotFoundation(c2d, 10, 20, 120, 80, "客栈");
    expect(c2d.fillText).toHaveBeenCalled();
  });

  it("draws built plaque caption", () => {
    const c2d = {
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      font: "",
      textAlign: "",
      textBaseline: "",
    } as unknown as CanvasRenderingContext2D;
    drawBuiltSlotPlaque(c2d, 0, 0, 100, "官府 · Lv1");
    expect(c2d.fillText).toHaveBeenCalledWith("官府 · Lv1", expect.any(Number), expect.any(Number));
  });
});
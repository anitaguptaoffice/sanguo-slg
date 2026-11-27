import type { CityBuilding } from "@/net/bootstrapSession";

export type SlotPlaqueInput = {
  label: string;
  building?: CityBuilding;
};

/** 未建槽：等距石基 + 虚线框 + 匾额 */
export function drawUnbuiltSlotFoundation(
  c2d: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
): void {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const bw = Math.min(w * 0.55, 100);
  const bh = Math.min(h * 0.22, 36);
  c2d.save();
  c2d.translate(cx, cy);
  c2d.beginPath();
  c2d.moveTo(0, -bh);
  c2d.lineTo(bw, 0);
  c2d.lineTo(0, bh);
  c2d.lineTo(-bw, 0);
  c2d.closePath();
  c2d.fillStyle = "rgba(58, 48, 38, 0.55)";
  c2d.fill();
  c2d.setLineDash([4, 3]);
  c2d.strokeStyle = "rgba(201, 162, 39, 0.55)";
  c2d.lineWidth = 1.5;
  c2d.stroke();
  c2d.setLineDash([]);
  const plaqueW = Math.min(w, Math.max(label.length * 14 + 24, 72));
  const plaqueH = 26;
  const py = -bh - plaqueH - 6;
  c2d.fillStyle = "rgba(26, 20, 16, 0.88)";
  c2d.strokeStyle = "rgba(201, 162, 39, 0.65)";
  c2d.lineWidth = 1;
  roundRect(c2d, -plaqueW / 2, py, plaqueW, plaqueH, 4);
  c2d.fill();
  c2d.stroke();
  c2d.fillStyle = "#f5e6c8";
  c2d.font = "600 12px 'Noto Sans SC', system-ui, sans-serif";
  c2d.textAlign = "center";
  c2d.textBaseline = "middle";
  c2d.fillText(label, 0, py + plaqueH / 2 - 1);
  c2d.fillStyle = "rgba(184, 166, 138, 0.95)";
  c2d.font = "10px system-ui, sans-serif";
  c2d.fillText("可建造", 0, py + plaqueH + 10);
  c2d.restore();
}

/** 已建：居中单条铭牌 `建筑名 · LvN` */
export function drawBuiltSlotPlaque(
  c2d: CanvasRenderingContext2D,
  displayX: number,
  displayY: number,
  displayW: number,
  caption: string,
): void {
  const plaqueW = Math.min(displayW, Math.max(caption.length * 11 + 20, 88));
  const plaqueH = 22;
  const px = displayX + (displayW - plaqueW) / 2;
  const py = displayY - plaqueH - 4;
  c2d.fillStyle = "rgba(26, 20, 16, 0.9)";
  c2d.strokeStyle = "rgba(201, 162, 39, 0.7)";
  c2d.lineWidth = 1;
  roundRect(c2d, px, py, plaqueW, plaqueH, 4);
  c2d.fill();
  c2d.stroke();
  c2d.fillStyle = "#f5e6c8";
  c2d.font = "600 12px 'Noto Sans SC', system-ui, sans-serif";
  c2d.textAlign = "center";
  c2d.textBaseline = "middle";
  c2d.fillText(caption, px + plaqueW / 2, py + plaqueH / 2);
  c2d.textAlign = "start";
  c2d.textBaseline = "alphabetic";
}

function roundRect(
  c2d: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  c2d.beginPath();
  c2d.moveTo(x + r, y);
  c2d.lineTo(x + w - r, y);
  c2d.quadraticCurveTo(x + w, y, x + w, y + r);
  c2d.lineTo(x + w, y + h - r);
  c2d.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c2d.lineTo(x + r, y + h);
  c2d.quadraticCurveTo(x, y + h, x, y + h - r);
  c2d.lineTo(x, y + r);
  c2d.quadraticCurveTo(x, y, x + r, y);
  c2d.closePath();
}
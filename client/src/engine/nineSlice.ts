/** Draw nine-slice panel; margins are in logical px at 1× (multiply by textureScale for source pixels). */
export function drawNineSlice(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
  margins: { left: number; top: number; right: number; bottom: number },
  textureScale: 1 | 2,
): void {
  const sw = (img as HTMLImageElement).naturalWidth || (img as HTMLCanvasElement).width;
  const sh = (img as HTMLImageElement).naturalHeight || (img as HTMLCanvasElement).height;
  const L = margins.left * textureScale;
  const T = margins.top * textureScale;
  const R = margins.right * textureScale;
  const B = margins.bottom * textureScale;
  const cw = sw - L - R;
  const ch = sh - T - B;
  const dw = w - margins.left - margins.right;
  const dh = h - margins.top - margins.bottom;

  const blit = (
    sx: number,
    sy: number,
    sww: number,
    shh: number,
    dx: number,
    dy: number,
    dww: number,
    dhh: number,
  ) => {
    if (sww <= 0 || shh <= 0 || dww <= 0 || dhh <= 0) return;
    ctx.drawImage(img, sx, sy, sww, shh, dx, dy, dww, dhh);
  };

  blit(0, 0, L, T, x, y, margins.left, margins.top);
  blit(L, 0, cw, T, x + margins.left, y, dw, margins.top);
  blit(L + cw, 0, R, T, x + w - margins.right, y, margins.right, margins.top);

  blit(0, T, L, ch, x, y + margins.top, margins.left, dh);
  blit(L, T, cw, ch, x + margins.left, y + margins.top, dw, dh);
  blit(L + cw, T, R, ch, x + w - margins.right, y + margins.top, margins.right, dh);

  blit(0, T + ch, L, B, x, y + h - margins.bottom, margins.left, margins.bottom);
  blit(L, T + ch, cw, B, x + margins.left, y + h - margins.bottom, dw, margins.bottom);
  blit(L + cw, T + ch, R, B, x + w - margins.right, y + h - margins.bottom, margins.right, margins.bottom);
}

import { applyMarchTargetToForm } from "@/net/worldFormat";

/** sessionStorage：本会话最近一次出征目标格点（与 CLIENT-013 to_x/to_y 一致）。 */
export const MARCH_TARGET_SESSION_KEY = "rxsg.client.marchTarget.last";

export const DEFAULT_MARCH_TARGET = { x: 5, y: 5 };

export type MarchTargetCoords = { x: number; y: number };

/** 写入表单的来源，用于状态栏文案与高亮（CLIENT-043）。 */
export type MarchTargetSource =
  | "minimap"
  | "world_city"
  | "start_march"
  | "session_restore"
  | "march_intel";

/**
 * 出征目标记忆与冲突（CLIENT-043），相对 CLIENT-015 / CLIENT-041：
 *
 * - **持久化**：`writeMarchTargetSession` 在 (1) 小地图空白单击填点、(2) 世界城池列表点选填坐标、
 *   (3) `StartMarch` 成功后写入；三者共用同一键，**以最后一次上述操作为准**（覆盖写入，无合并）。
 * - **初始加载**：`restoreMarchTargetToForm` 用 session 预填 to_x/to_y；若用户随后点城或小地图选点，立即覆盖表单与 session。
 * - **CLIENT-015 vs CLIENT-041**：二者都走 `applyMarchTargetAndRemember`；后发生的点选/单击胜出，状态栏说明已更新。
 * - **CLIENT-037**：点小地图行军目的点只选中列表行，**不**改出征目标（见 MainCityScene，不走本模块）。
 * - **清除**：`clearMarchTargetFromForm` 删除 session 并将表单恢复为 `DEFAULT_MARCH_TARGET`。
 */
export function parseMarchTargetSessionValue(raw: string | null | undefined): MarchTargetCoords | null {
  if (raw == null || raw === "") return null;
  try {
    const parsed = JSON.parse(raw) as { x?: unknown; y?: unknown };
    const x = Number(parsed.x);
    const y = Number(parsed.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x: Math.trunc(x), y: Math.trunc(y) };
  } catch {
    return null;
  }
}

export function readMarchTargetSession(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): MarchTargetCoords | null {
  try {
    return parseMarchTargetSessionValue(storage?.getItem(MARCH_TARGET_SESSION_KEY) ?? null);
  } catch {
    return null;
  }
}

export function parseMarchTargetCoordField(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

/** 读取军事面板 to_x/to_y 当前值（未校验 session）。 */
export function readMarchTargetFromForm(
  formRoot: ParentNode | null | undefined,
): MarchTargetCoords | null {
  if (!formRoot) return null;
  const xEl = formRoot.querySelector('[data-field="to-x"]') as HTMLInputElement | null;
  const yEl = formRoot.querySelector('[data-field="to-y"]') as HTMLInputElement | null;
  if (!xEl || !yEl) return null;
  const x = parseMarchTargetCoordField(xEl.value);
  const y = parseMarchTargetCoordField(yEl.value);
  if (x == null || y == null) return null;
  return { x, y };
}

/**
 * 出征目标事实源：session 记忆优先，否则表单解析（CLIENT-139 小地图角标/汇总同源）。
 */
export function resolveMarchTargetTruth(
  formRoot: ParentNode | null | undefined,
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): MarchTargetCoords | null {
  const stored = readMarchTargetSession(storage);
  if (stored) return stored;
  return readMarchTargetFromForm(formRoot);
}

/** 手动改 to_x/to_y 时将会话记忆与表单对齐。 */
export function syncMarchTargetSessionFromForm(
  formRoot: ParentNode | null | undefined,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): MarchTargetCoords | null {
  const fromForm = readMarchTargetFromForm(formRoot);
  if (!fromForm) return null;
  writeMarchTargetSession(fromForm.x, fromForm.y, storage);
  return fromForm;
}

export function writeMarchTargetSession(
  x: number,
  y: number,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  try {
    storage?.setItem(
      MARCH_TARGET_SESSION_KEY,
      JSON.stringify({ x: Math.trunc(x), y: Math.trunc(y) }),
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearMarchTargetSession(
  storage: Pick<Storage, "removeItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  try {
    storage?.removeItem(MARCH_TARGET_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function marchTargetStatusMessage(source: MarchTargetSource, x: number, y: number): string {
  const coord = `(${x},${y})`;
  switch (source) {
    case "minimap":
      return `已选出征目标 ${coord}（小地图选点，已记住）`;
    case "world_city":
      return `出征目标 ${coord}（世界城池，已记住；覆盖上次记忆）`;
    case "start_march":
      return `出征目标 ${coord} 已记住`;
    case "session_restore":
      return `已恢复上次出征目标 ${coord}`;
    case "march_intel":
      return `军情再出征：已预填目标 ${coord}（已记住）`;
    default:
      return `出征目标 ${coord}`;
  }
}

export const MARCH_TARGET_FIELD_HIGHLIGHT_CLASS = "march-target-field-highlight";

export function setMarchTargetFieldHighlight(
  formRoot: ParentNode | null | undefined,
  on: boolean,
): void {
  if (!formRoot) return;
  const block = formRoot.querySelector('[data-role="march-target-fields"]');
  block?.classList.toggle(MARCH_TARGET_FIELD_HIGHLIGHT_CLASS, on);
}

/** 写入表单并同步 session；成功时可选高亮（小地图选点）。 */
export function applyMarchTargetAndRemember(
  formRoot: ParentNode | null | undefined,
  x: number,
  y: number,
  opts?: {
    source?: MarchTargetSource;
    storage?: Pick<Storage, "setItem"> | null;
    highlightMinimapPick?: boolean;
  },
): boolean {
  const applied = applyMarchTargetToForm(formRoot, x, y);
  if (!applied) return false;
  writeMarchTargetSession(x, y, opts?.storage ?? null);
  if (opts?.highlightMinimapPick || opts?.source === "minimap") {
    setMarchTargetFieldHighlight(formRoot, true);
  }
  return true;
}

export function restoreMarchTargetToForm(
  formRoot: ParentNode | null | undefined,
  fallback: MarchTargetCoords = DEFAULT_MARCH_TARGET,
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): MarchTargetCoords | null {
  const stored = readMarchTargetSession(storage);
  const target = stored ?? null;
  if (target) {
    applyMarchTargetToForm(formRoot, target.x, target.y);
    return target;
  }
  applyMarchTargetToForm(formRoot, fallback.x, fallback.y);
  return null;
}

export function clearMarchTargetFromForm(
  formRoot: ParentNode | null | undefined,
  fallback: MarchTargetCoords = DEFAULT_MARCH_TARGET,
  storage: Pick<Storage, "removeItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  clearMarchTargetSession(storage);
  applyMarchTargetToForm(formRoot, fallback.x, fallback.y);
  setMarchTargetFieldHighlight(formRoot, false);
}

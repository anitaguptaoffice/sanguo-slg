/** sessionStorage：详情「去招募」返回招募区时滚动的 `template_cfg_id`（CLIENT-166）。 */
export const RECRUIT_SCROLL_ANCHOR_SESSION_KEY = "recruit-scroll-anchor-v1";

export function parseRecruitScrollAnchorSessionValue(
  raw: string | null | undefined,
): number | null {
  if (raw == null || raw === "") return null;
  const id = Math.trunc(Number(raw));
  return id > 0 ? id : null;
}

export function writeRecruitScrollAnchorSession(
  templateCfgId: number,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  if (templateCfgId <= 0 || !storage) return;
  try {
    storage.setItem(RECRUIT_SCROLL_ANCHOR_SESSION_KEY, String(templateCfgId));
  } catch {
    /* quota / private mode */
  }
}

export function readRecruitScrollAnchorSession(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): number | null {
  try {
    return parseRecruitScrollAnchorSessionValue(
      storage?.getItem(RECRUIT_SCROLL_ANCHOR_SESSION_KEY) ?? null,
    );
  } catch {
    return null;
  }
}

export function clearRecruitScrollAnchorSession(
  storage: Pick<Storage, "removeItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  try {
    storage?.removeItem(RECRUIT_SCROLL_ANCHOR_SESSION_KEY);
  } catch {
    /* private mode */
  }
}

/** 滚动招募模板列表至指定 cfg 行（`.panel-scroll-body` 内）。 */
export function scrollToRecruitTemplateRow(
  panelRoot: ParentNode | null | undefined,
  templateCfgId: number,
): boolean {
  if (!panelRoot || templateCfgId <= 0) return false;
  const row = panelRoot.querySelector(`li[data-template-id="${templateCfgId}"]`);
  if (row && typeof row.scrollIntoView === "function") {
    row.scrollIntoView({ block: "nearest", behavior: "auto" });
    return true;
  }
  return false;
}

/**
 * 消费 session 锚点并滚动；模板行存在时清除键。
 * @returns 是否完成滚动
 */
export function applyRecruitScrollAnchorSession(
  panelRoot: ParentNode | null | undefined,
  storage: Pick<Storage, "getItem" | "removeItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): boolean {
  const templateCfgId = readRecruitScrollAnchorSession(storage);
  if (templateCfgId == null) return false;
  const scrolled = scrollToRecruitTemplateRow(panelRoot, templateCfgId);
  if (scrolled) clearRecruitScrollAnchorSession(storage);
  return scrolled;
}

/** sessionStorage：自深链打开背包时的来源（CLIENT-175）。 */
export const BAG_OPEN_SOURCE_SESSION_KEY = "bag-open-source-v1";

export type BagOpenSource = "daily" | "hero" | "shop";

const SOURCE_VALUES: readonly BagOpenSource[] = ["daily", "hero", "shop"];

export function parseBagOpenSource(raw: string | null | undefined): BagOpenSource | null {
  if (raw == null || raw === "") return null;
  if ((SOURCE_VALUES as readonly string[]).includes(raw)) {
    return raw as BagOpenSource;
  }
  return null;
}

export function formatBagOpenSourceTagLabel(source: BagOpenSource): string {
  switch (source) {
    case "daily":
      return "来源：日常";
    case "hero":
      return "来源：将领养成";
    case "shop":
      return "来源：商城";
    default:
      return "来源";
  }
}

export function readBagOpenSourceSession(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): BagOpenSource | null {
  try {
    return parseBagOpenSource(storage?.getItem(BAG_OPEN_SOURCE_SESSION_KEY) ?? null);
  } catch {
    return null;
  }
}

export function writeBagOpenSourceSession(
  source: BagOpenSource,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  try {
    storage?.setItem(BAG_OPEN_SOURCE_SESSION_KEY, source);
  } catch {
    /* quota / private mode */
  }
}

export function clearBagOpenSourceSession(
  storage: Pick<Storage, "removeItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  try {
    storage?.removeItem(BAG_OPEN_SOURCE_SESSION_KEY);
  } catch {
    /* private mode */
  }
}

/** 深链 query 字段名（与 hero-bag-deep-link-query-v1 并存）。 */
export const BAG_OPEN_SOURCE_QUERY_KEY = "bagOpenSource";

export function appendBagOpenSourceQuery(params: URLSearchParams, source: BagOpenSource): void {
  params.set(BAG_OPEN_SOURCE_QUERY_KEY, source);
}

import type { CityTroopStack, MainCitySession } from "@/net/bootstrapSession";

/** Full ready-only snapshot. Null is unknown, never an empty army. */
export function parseGarrison(value: unknown): CityTroopStack[] | null {
  if (value == null) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid garrison");
  const raw = (value as { troops?: unknown }).troops;
  const rows = raw === undefined ? [] : raw;
  if (!Array.isArray(rows)) throw new Error("Invalid garrison troops");
  let previous = 0;
  return rows.map((row) => {
    const id = row?.unit_cfg_id;
    const count = row?.count;
    if (!Number.isInteger(id) || id <= previous || id > 2147483647 ||
        !Number.isInteger(count) || count <= 0 || count > 2147483647) {
      throw new Error("Invalid garrison row/order");
    }
    previous = id;
    return { unit_cfg_id: id, count };
  });
}

export function garrisonPatch(session: Pick<MainCitySession, "cityTroops" | "garrisonStatus">, value: unknown):
  Pick<MainCitySession, "cityTroops" | "garrisonStatus"> {
  try {
    const rows = parseGarrison(value);
    if (rows !== null) return { cityTroops: rows, garrisonStatus: "ready" };
  } catch { /* Invalid data is not an authoritative replacement. */ }
  return { cityTroops: session.cityTroops, garrisonStatus: session.garrisonStatus === "unknown" ? "unknown" : "stale" };
}

export function readyGarrison(session: MainCitySession | null): CityTroopStack[] {
  return session?.garrisonStatus === "ready" ? session.cityTroops : [];
}

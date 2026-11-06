import type { GatewayPort } from "./GatewayClient";
import type { MarchSummary } from "./militaryFormat";
import { captureActor } from "./actorContext";

/** ListMarches offsets count indexed records, including returned or missing Hub rows. */
export async function readMarchListSnapshot(
  gateway: GatewayPort, cityId?: number, current: () => boolean = () => true,
): Promise<{ marches: MarchSummary[]; total: number }> {
  const actor = captureActor(gateway, () => null);
  const marches: MarchSummary[] = [];
  let total: number | undefined;
  // Preserve the existing first-page request; subsequent pages use the server's maximum.
  for (let offset = 0, limit = 20; ; offset += limit, limit = 100) {
    if (!actor() || !current()) throw new Error("行军会话已变化");
    const page = await gateway.listMarches(cityId, limit, offset) as { marches?: MarchSummary[]; total?: number };
    if (!actor() || !current()) throw new Error("行军会话已变化");
    const rows = page.marches ?? [];
    if (offset === 0 && page.total == null) return { marches: rows, total: rows.length };
    if (!Number.isInteger(page.total) || page.total! < 0 || page.total! > 2147483647) throw new Error("行军分页总数无效");
    if (total !== undefined && page.total !== total) throw new Error("行军列表已变化，请刷新");
    total = page.total!;
    marches.push(...rows);
    if (offset + limit >= total) return { marches, total };
  }
}

import { afterEach, describe, expect, it, vi } from "vitest";
import { GatewayClient } from "@/net/GatewayClient";
import { getTypes, Routes } from "@/net/loadProto";
import { decodeGatewayResponse } from "@/net/decodeGatewayResponse";
import {
  formatMarchEta, formatMarchHint, formatMarchListSecondary, formatMarchPhase,
  formatMarchRowMetaLine, formatMarchRowRecentEtaBrief, formatTimeMs, marchEtaDeadline,
  type MarchSummary,
} from "@/net/militaryFormat";
import { formatMarchEtaLine } from "@/net/marchInfoCard";
import { formatMarchIntelPhaseEtaStrip } from "@/net/marchIntelPhaseEtaStrip";
import { formatMarchReadonlyLineFromMarch } from "@/net/marchFormReadonlyStrip";
import { marchListEtaSortKey } from "@/net/militaryListFilter";
import { formatMinimapDestEtaLabel, minimapPhaseCaption } from "./worldMinimap";
import { MarchListPanel } from "./MarchListPanel";

const types = getTypes();
// Recorded native march 1: only the display is under test, not live battle acceptance.
const native: MarchSummary = {
  march_id: 1, phase: 4, from_x: 60, from_y: 60, to_x: 5, to_y: 5,
  depart_at_ms: 1792982905817, arrive_at_ms: 1792986865817,
  return_finish_at_ms: 1792990825821, troops: [{ unit_cfg_id: 1, count: 200, wounded: 0 }],
};
const returnedAt = native.return_finish_at_ms!;
function bytes(m: MarchSummary) {
  return types.ListMarchesResponse.encode(types.ListMarchesResponse.fromObject({ marches: [m], total: 1 })).finish();
}
function decoded(m: MarchSummary): MarchSummary {
  return (decodeGatewayResponse(types.ListMarchesResponse, bytes(m)).marches as MarchSummary[])[0];
}
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); sessionStorage.clear(); document.body.innerHTML = ""; });

describe("authoritative return ETA across production display paths", () => {
  it("keeps exact real protobuf return milliseconds and local absolute-time convention", () => {
    const march = decoded(native), now = Date.UTC(2026, 9, 26, 3, 55);
    expect(typeof march.return_finish_at_ms).toBe("number");
    expect(marchEtaDeadline(march)).toBe(returnedAt);
    expect(formatMarchPhase(march.phase)).toBe("返程中");
    for (const line of [formatMarchRowMetaLine(march, now), formatMarchHint(march), formatMarchIntelPhaseEtaStrip(march, now)]) {
      expect(line).toContain(`回城 ${formatTimeMs(returnedAt)}`);
      expect(line).not.toContain(formatTimeMs(native.arrive_at_ms));
      expect(line).not.toContain("撤回");
    }
    for (const line of [formatMarchListSecondary(march, now), formatMarchRowRecentEtaBrief(march, now),
      formatMarchEtaLine(march, now), formatMarchReadonlyLineFromMarch(march, now), minimapPhaseCaption(march, now)]) {
      expect(line).toContain("剩余 66m");
    }
    expect(formatMinimapDestEtaLabel(march, now)).toBe("66");
    expect(marchListEtaSortKey(march, now)).toBe(returnedAt);
  });

  it.each([undefined, 0, -1, NaN, Infinity])("never substitutes outbound deadline for missing/invalid return %s", deadline => {
    const march = { ...native, return_finish_at_ms: deadline }, now = returnedAt - 120_000;
    expect(marchEtaDeadline(march)).toBeUndefined();
    for (const line of [formatMarchEta(march, now), formatMarchListSecondary(march, now),
      formatMarchRowMetaLine(march, now), formatMarchRowRecentEtaBrief(march, now), formatMarchEtaLine(march, now),
      formatMarchIntelPhaseEtaStrip(march, now), formatMarchReadonlyLineFromMarch(march, now), minimapPhaseCaption(march, now)]) {
      expect(line).toContain("时间未知");
      expect(line).not.toMatch(/即将|剩余|剩 \d+s/);
    }
    expect(formatMinimapDestEtaLabel(march, now)).toBe("未知");
    expect(formatMarchHint(march)).toContain("预计回城 —");
    expect(marchListEtaSortKey(march, now)).toBe(Infinity);
  });

  it.each([undefined, 0, -1])("keeps protobuf missing/nonpositive return %s unknown", deadline => {
    expect(formatMarchEta(decoded({ ...native, return_finish_at_ms: deadline }), returnedAt - 120_000)).toBe("时间未知");
  });

  it.each([[60001, "剩余 2m", "2"], [60000, "即将到达", "即将"], [1, "即将到达", "即将"],
    [0, "即将到达", "即将"], [-1, "即将到达", "即将"]] as const)("preserves soon boundary at %s ms", (remaining, full, short) => {
    const now = returnedAt - remaining;
    expect(formatMarchEta(decoded(native), now)).toBe(full);
    expect(formatMinimapDestEtaLabel(native, now)).toBe(short);
    const strip = formatMarchIntelPhaseEtaStrip(native, now);
    expect(strip).toContain(`回城 ${formatTimeMs(returnedAt)}`);
    if (remaining > 0) expect(strip).toContain(`剩 ${Math.ceil(remaining / 1000)}s`);
    else expect(strip).not.toContain("剩 ");
  });

  it.each([0, 1, 2, 3, 99])("preserves non-return phase %s and ignores return deadline", phase => {
    const march = decoded({ ...native, phase }), now = native.arrive_at_ms! - 120_000;
    expect(marchEtaDeadline(march)).toBe(native.arrive_at_ms);
    expect(formatMarchListSecondary(march, now)).toBe(phase === 2 ? "剩余 2m · 行军中" : formatMarchPhase(phase));
    expect(formatMarchIntelPhaseEtaStrip(march, now)).toContain(phase === 2 ? "剩 120s" : formatMarchPhase(phase));
    expect(formatMarchRowMetaLine(march, now)).toContain(`到达 ${formatTimeMs(native.arrive_at_ms)}`);
    expect(formatMarchListSecondary({ phase }, now)).toBe(phase === 2 ? "即将到达 · 行军中" : formatMarchPhase(phase));
  });

  it("production GatewayClient rows tick at the boundary and replace repeated/stale snapshots without retaining a deadline", async () => {
    vi.useFakeTimers();
    let snapshot = native, now = returnedAt - 60001;
    const gateway = new GatewayClient();
    const send = vi.spyOn(gateway as never, "sendAndWait").mockImplementation((wire: Uint8Array) => {
      const request = types.ClientPacket.decode(wire) as unknown as { route: string };
      expect(request.route).toBe(Routes.ListMarches);
      return Promise.resolve(Uint8Array.from(types.ServerPacket.encode({ code: 0, data: bytes(snapshot) }).finish()).buffer);
    });
    const mount = document.createElement("div"); document.body.append(mount);
    const panel = new MarchListPanel(mount, gateway, () => 1, () => {}, { nowMs: () => now, pollIntervalMs: 60_000 });
    panel.attach(); panel.toggle(); await vi.advanceTimersByTimeAsync(0);
    const row = () => mount.querySelector<HTMLLIElement>('.march-list li[data-march-id="1"]')!;
    const strip = () => row().querySelector(".intel-row-phase-subline")!.textContent!;
    try {
      expect(strip()).toContain("剩余 2m");
      row().click();
      now += 1; await vi.advanceTimersByTimeAsync(1000);
      expect(strip()).toContain("即将到达");
      expect(strip()).toContain(`回城 ${formatTimeMs(returnedAt)}`);
      expect(mount.querySelector('[data-role="march-info-card-secondary"]')?.textContent).toContain("ETA 即将到达");
      expect(send).toHaveBeenCalledTimes(1);
      for (const deadline of [returnedAt, 0, returnedAt + 180_000, returnedAt - 600_000, 0]) {
        snapshot = { ...native, return_finish_at_ms: deadline };
        mount.querySelector<HTMLButtonElement>('[data-action="refresh-marches"]')!.click();
        await vi.advanceTimersByTimeAsync(0);
        const expected = formatMarchEta(snapshot, now);
        expect(strip()).toContain(expected);
        expect(row().querySelector(".march-row-meta")?.textContent).toContain(expected);
        expect(mount.querySelector('[data-role="march-info-card-secondary"]')?.textContent).toContain(expected);
        expect(strip()).not.toContain(formatTimeMs(native.arrive_at_ms));
      }
      expect(send).toHaveBeenCalledTimes(6);
    } finally { panel.detach(); }
  });
});

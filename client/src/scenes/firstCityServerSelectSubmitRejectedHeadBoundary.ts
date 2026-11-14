import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCitySubmitRejectedHeadBoundaryView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | Readonly<{
      kind: "rejected-head";
      commandId: string;
      name: string;
      x: number;
      y: number;
      reason: "terrain" | "coordinateOccupied";
    }>;

/** When durable head is rejected, loopback Submit stays on EMPTY only; successor INITIAL needs exact rejected predecessor. */
export function resolveFirstCitySubmitRejectedHeadBoundaryView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCitySubmitRejectedHeadBoundaryView {
  if (!knowledge) return { kind: "withheld", reason: "no-knowledge" };
  if (staleActor) return { kind: "withheld", reason: "stale-actor" };
  if (knowledge.unavailable) return { kind: "withheld", reason: "unavailable" };
  if (knowledge.incomplete || knowledge.head === null) return { kind: "withheld", reason: "incomplete" };
  if (knowledge.head.kind === "empty") return { kind: "none" };
  const record = knowledge.head.record;
  if (record.state.kind !== "rejected") return { kind: "none" };
  const { commandId, name, x, y } = record.intent.proposal;
  return {
    kind: "rejected-head",
    commandId,
    name,
    x,
    y,
    reason: record.state.reason,
  };
}

export function formatFirstCitySubmitRejectedHeadBoundaryPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCitySubmitRejectedHeadBoundaryView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "Submit rejected-head 边界（只读）：证据冲突或不可用，暂不说明 rejected head 下的 Submit 门控；" +
        "不得以表单自动 Submit 或推断后继 predecessor。未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "Submit rejected-head 边界（只读）：证据不完整，暂不说明 rejected head 下的 Submit 门控；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  const label = `${view.name} (${view.x},${view.y}) · ${view.reason}`;
  return (
    `Submit rejected-head 边界（只读）：durable head ${view.commandId} · rejected · ${label}。` +
    "本 loopback 面板仅在 EMPTY head 下启用 V2 Submit；" +
    `后继显式 INITIAL 须 new commandId 且 predecessor=rejected ${view.commandId}（wire §3/§5；§5.2(7)）。` +
    "Continue/Submit 须显式点击。不宣称可玩首城或生产验收已完成。"
  );
}
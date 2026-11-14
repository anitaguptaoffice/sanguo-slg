import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityContinueRejectedHeadBoundaryView =
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

/** When durable head is rejected, loopback Continue stays off; successor INITIAL needs exact rejected predecessor. */
export function resolveFirstCityContinueRejectedHeadBoundaryView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityContinueRejectedHeadBoundaryView {
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

export function formatFirstCityContinueRejectedHeadBoundaryPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityContinueRejectedHeadBoundaryView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "Continue rejected-head 边界（只读）：证据冲突或不可用，暂不说明 rejected head 下的 Continue 门控；" +
        "不得以 Continue 代替后继 INITIAL 或推断执行授权。未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "Continue rejected-head 边界（只读）：证据不完整，暂不说明 rejected head 下的 Continue 门控；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  const label = `${view.name} (${view.x},${view.y}) · ${view.reason}`;
  return (
    `Continue rejected-head 边界（只读）：durable head ${view.commandId} · rejected · ${label}。` +
    "本 loopback 面板仅在 PENDING head 下启用 V2 Continue 执行；" +
    `后继显式 INITIAL 须 new commandId 且 predecessor=rejected ${view.commandId}（wire §5/§6；§5.2(7)）。` +
    "已知终态 Continue 仅为读回 COMMAND，不代表新执行。Continue/Submit 须显式点击。不宣称可玩首城或生产验收已完成。"
  );
}
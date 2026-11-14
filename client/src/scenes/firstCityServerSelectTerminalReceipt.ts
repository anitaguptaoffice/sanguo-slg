import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";
import type { FirstCityState } from "@/net/firstCityResponseCodec";

export type FirstCityTerminalReceiptView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | Readonly<{
      kind: "succeeded";
      commandId: string;
      name: string;
      x: number;
      y: number;
      cityId: bigint;
      shard: number;
      playerId: bigint;
      isCapital: true;
      wallLevel: 1;
      morale: 100;
    }>
  | Readonly<{
      kind: "rejected";
      commandId: string;
      name: string;
      x: number;
      y: number;
      reason: "terrain" | "coordinateOccupied";
    }>;

function proposalFields(record: { intent: { proposal: { commandId: string; name: string; x: number; y: number } } }) {
  const { commandId, name, x, y } = record.intent.proposal;
  return { commandId, name, x, y };
}

/** Durable head terminal receipt; distinct from canonical winner proposal summary. */
export function resolveFirstCityTerminalReceiptView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityTerminalReceiptView {
  if (!knowledge) return { kind: "withheld", reason: "no-knowledge" };
  if (staleActor) return { kind: "withheld", reason: "stale-actor" };
  if (knowledge.unavailable) return { kind: "withheld", reason: "unavailable" };
  if (knowledge.incomplete || knowledge.head === null) return { kind: "withheld", reason: "incomplete" };
  if (knowledge.head.kind === "empty") return { kind: "none" };
  const state: FirstCityState = knowledge.head.record.state;
  const base = proposalFields(knowledge.head.record);
  if (state.kind === "pending") return { kind: "none" };
  if (state.kind === "succeeded") {
    return {
      kind: "succeeded",
      ...base,
      cityId: state.cityId,
      shard: state.shard,
      playerId: state.playerId,
      isCapital: state.isCapital,
      wallLevel: state.wallLevel,
      morale: state.morale,
    };
  }
  return { kind: "rejected", ...base, reason: state.reason };
}

function rejectionLabel(reason: "terrain" | "coordinateOccupied"): string {
  return reason === "terrain" ? "TERRAIN" : "COORDINATE_OCCUPIED";
}

export function formatFirstCityTerminalReceiptPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityTerminalReceiptView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return "终态 receipt（只读）：证据冲突或不可用，暂不展示 durable head 的 succeeded/rejected 载荷；不得据此进主城。未自动 Continue/Submit。";
    }
    if (view.reason === "incomplete") {
      return "终态 receipt（只读）：证据不完整，暂不展示 durable head 终态；须保留本地记录并显式 Discover/GetResult。未进入主城。";
    }
    return "";
  }
  if (view.kind === "none") return "";
  if (view.kind === "succeeded") {
    return (
      `终态 receipt（只读）：${view.commandId} · ${view.name} (${view.x},${view.y}) · succeeded · ` +
      `cityId=${view.cityId} shard=${view.shard} playerId=${view.playerId} · ` +
      `isCapital=${view.isCapital} wallLevel=${view.wallLevel} morale=${view.morale}。` +
      "历史创建结果不授予当前主城进入权；Continue/Submit 须显式点击。不宣称可玩首城或生产验收已完成。"
    );
  }
  return (
    `终态 receipt（只读）：${view.commandId} · ${view.name} (${view.x},${view.y}) · rejected · ` +
    `reason=${rejectionLabel(view.reason)}。该原因描述已结束尝试，非实时地形；未进入主城，不宣称可玩首城。`
  );
}

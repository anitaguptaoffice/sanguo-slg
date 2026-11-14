import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityDiscoverRejectedHeadBoundaryView =
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

/** When durable head is REJECTED, loopback Discover remains read-only actor refresh only. */
export function resolveFirstCityDiscoverRejectedHeadBoundaryView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityDiscoverRejectedHeadBoundaryView {
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

export function formatFirstCityDiscoverRejectedHeadBoundaryPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityDiscoverRejectedHeadBoundaryView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "Discover rejected-head 边界（只读）：证据冲突或不可用，暂不说明 rejected head 下的 Discover 门控；" +
        "不得以重复 Discover 代替后继 Submit successor 或 Continue 执行。未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "Discover rejected-head 边界（只读）：证据不完整，暂不说明 rejected head 下的 Discover 门控；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  const label = `${view.name} (${view.x},${view.y}) · ${view.reason}`;
  return (
    `Discover rejected-head 边界（只读）：durable head ${view.commandId} · rejected · ${label}。` +
    "本 loopback 面板 DiscoverFirstCityIntent 仅为只读权威刷新（返回 scope/head 视图，不接收、不执行、不改 head）。" +
    `不得用重复 Discover 代替后继显式 INITIAL 的 V2 Submit（predecessor=rejected ${view.commandId}）或 Continue 执行（wire §5/§6；§5.2(7)）。` +
    "见 Submit/Continue/Get rejected-head 边界行；actor discovery EMPTY 只读行仅在 EMPTY head 展示。Discover 须显式点击。" +
    "不宣称可玩首城或生产验收已完成。"
  );
}
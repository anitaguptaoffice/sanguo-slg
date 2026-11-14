import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityDiscoverPendingHeadBoundaryView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | Readonly<{
      kind: "pending-head";
      commandId: string;
      name: string;
      x: number;
      y: number;
    }>;

/** When durable head is PENDING, loopback Discover remains read-only actor refresh only. */
export function resolveFirstCityDiscoverPendingHeadBoundaryView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityDiscoverPendingHeadBoundaryView {
  if (!knowledge) return { kind: "withheld", reason: "no-knowledge" };
  if (staleActor) return { kind: "withheld", reason: "stale-actor" };
  if (knowledge.unavailable) return { kind: "withheld", reason: "unavailable" };
  if (knowledge.incomplete || knowledge.head === null) return { kind: "withheld", reason: "incomplete" };
  if (knowledge.head.kind === "empty") return { kind: "none" };
  const record = knowledge.head.record;
  if (record.state.kind !== "pending") return { kind: "none" };
  const { commandId, name, x, y } = record.intent.proposal;
  return { kind: "pending-head", commandId, name, x, y };
}

export function formatFirstCityDiscoverPendingHeadBoundaryPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityDiscoverPendingHeadBoundaryView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "Discover pending-head 边界（只读）：证据冲突或不可用，暂不说明 PENDING head 下的 Discover 门控；" +
        "不得以重复 Discover 代替 Continue 或推断后继 INITIAL。未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "Discover pending-head 边界（只读）：证据不完整，暂不说明 PENDING head 下的 Discover 门控；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  const label = `${view.name} (${view.x},${view.y})`;
  return (
    `Discover pending-head 边界（只读）：durable head ${view.commandId} · pending · ${label}。` +
    "本 loopback 面板 DiscoverFirstCityIntent 仅为只读权威刷新（返回 scope/head 视图，不接收、不执行、不改 head）。" +
    "不得用重复 Discover 代替对 canonical winner 的 V2 Continue 执行或 competing EMPTY Submit（wire §5；§5.2(6)）。" +
    "见 Continue/Submit/Get pending-head 边界行；actor discovery EMPTY 只读行仅在 EMPTY head 展示。Discover 须显式点击。" +
    "不宣称可玩首城或生产验收已完成。"
  );
}
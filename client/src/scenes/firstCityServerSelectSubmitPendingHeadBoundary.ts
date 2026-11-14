import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCitySubmitPendingHeadBoundaryView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | Readonly<{
      kind: "pending-head";
      commandId: string;
      name: string;
      x: number;
      y: number;
    }>;

/** When durable head is PENDING, loopback Submit stays on EMPTY head only; competing EMPTY INITIAL is withheld. */
export function resolveFirstCitySubmitPendingHeadBoundaryView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCitySubmitPendingHeadBoundaryView {
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

export function formatFirstCitySubmitPendingHeadBoundaryPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCitySubmitPendingHeadBoundaryView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "Submit pending-head 边界（只读）：证据冲突或不可用，暂不说明 pending head 下的 Submit 门控；" +
        "不得以表单自动 Submit 或推断后继 INITIAL。未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "Submit pending-head 边界（只读）：证据不完整，暂不说明 pending head 下的 Submit 门控；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  const label = `${view.name} (${view.x},${view.y})`;
  return (
    `Submit pending-head 边界（只读）：durable head ${view.commandId} · pending · ${label}。` +
    "本 loopback 面板仅在 EMPTY head 下启用 V2 Submit（EMPTY predecessor）；" +
    "PENDING head 下不得再提交 competing EMPTY INITIAL（wire §5 HEAD_CONFLICT；§5.6(6)）。" +
    "须对 canonical winner 再次显式 Continue 或读回 COMMAND；Continue/Submit 须显式点击。" +
    "不宣称可玩首城或生产验收已完成。"
  );
}
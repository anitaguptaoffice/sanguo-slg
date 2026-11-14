import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityContinuePendingHeadBoundaryView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | Readonly<{
      kind: "pending-head";
      commandId: string;
      name: string;
      x: number;
      y: number;
    }>;

/** When durable head is PENDING, loopback Continue is offered; execution still requires explicit click. */
export function resolveFirstCityContinuePendingHeadBoundaryView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityContinuePendingHeadBoundaryView {
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

export function formatFirstCityContinuePendingHeadBoundaryPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityContinuePendingHeadBoundaryView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "Continue pending-head 边界（只读）：证据冲突或不可用，暂不说明 pending head 下的 Continue 门控；" +
        "不得以 Continue 自动执行或推断后继 INITIAL。未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "Continue pending-head 边界（只读）：证据不完整，暂不说明 pending head 下的 Continue 门控；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  const label = `${view.name} (${view.x},${view.y})`;
  return (
    `Continue pending-head 边界（只读）：durable head ${view.commandId} · pending · ${label}。` +
    "本 loopback 面板仅在 PENDING head 下启用 V2 Continue 执行；" +
    "非 pending head 不启用 Continue。须对 canonical winner 显式点击 Continue 后方可发送执行（wire §6；§5.2(6)）。" +
    "不得用 Continue 代替 competing EMPTY INITIAL Submit（见 Submit pending-head 边界）。Continue/Submit 须显式点击。" +
    "不宣称可玩首城或生产验收已完成。"
  );
}
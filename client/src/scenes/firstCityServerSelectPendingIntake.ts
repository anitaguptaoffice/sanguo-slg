import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityPendingIntakeView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | Readonly<{
      kind: "pending";
      commandId: string;
      name: string;
      x: number;
      y: number;
    }>;

/** Durable head PENDING intake; distinct from terminal receipt and canonical winner summary. */
export function resolveFirstCityPendingIntakeView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityPendingIntakeView {
  if (!knowledge) return { kind: "withheld", reason: "no-knowledge" };
  if (staleActor) return { kind: "withheld", reason: "stale-actor" };
  if (knowledge.unavailable) return { kind: "withheld", reason: "unavailable" };
  if (knowledge.incomplete || knowledge.head === null) return { kind: "withheld", reason: "incomplete" };
  if (knowledge.head.kind === "empty") return { kind: "none" };
  const record = knowledge.head.record;
  if (record.state.kind !== "pending") return { kind: "none" };
  const { commandId, name, x, y } = record.intent.proposal;
  return { kind: "pending", commandId, name, x, y };
}

export function formatFirstCityPendingIntakePanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityPendingIntakeView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return "PENDING 接收（只读）：证据冲突或不可用，暂不展示 durable head 的 pending 接收态；不得据此进主城或自动 Continue。未自动 Submit。";
    }
    if (view.reason === "incomplete") {
      return "PENDING 接收（只读）：证据不完整，暂不展示 durable head 的 pending 接收态；须保留本地记录并显式 Discover/GetResult。未进入主城。";
    }
    return "";
  }
  if (view.kind === "none") return "";
  return (
    `PENDING 接收（只读）：${view.commandId} · ${view.name} (${view.x},${view.y}) · 意图已接收，未完成。` +
    "不证明已有城市或没有正在执行的事务；PENDING 本身不是执行许可。Continue/Submit 须显式点击。不宣称可玩首城或生产验收已完成。"
  );
}

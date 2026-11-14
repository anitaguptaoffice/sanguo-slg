import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityGetPendingHeadBoundaryView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | Readonly<{
      kind: "pending-head";
      commandId: string;
      name: string;
      x: number;
      y: number;
    }>;

/** When durable head is PENDING, loopback GetResult is read-only lookup by owned commandId only. */
export function resolveFirstCityGetPendingHeadBoundaryView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityGetPendingHeadBoundaryView {
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

export function formatFirstCityGetPendingHeadBoundaryPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityGetPendingHeadBoundaryView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "Get pending-head 边界（只读）：证据冲突或不可用，暂不说明 PENDING head 下的 GetResult 门控；" +
        "不得以 GetResult 代替 Continue 或推断后继 INITIAL。未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "Get pending-head 边界（只读）：证据不完整，暂不说明 PENDING head 下的 GetResult 门控；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  const label = `${view.name} (${view.x},${view.y})`;
  return (
    `Get pending-head 边界（只读）：durable head ${view.commandId} · pending · ${label}。` +
    "本 loopback 面板仅对已保留/本地拥有的 commandId 启用显式 V2 GetResult" +
    "（只读，返回 COMMAND 或 NOT_OBSERVED，不接收、不改 head）。" +
    "不得用 GetResult 代替对 canonical winner 的 V2 Continue 执行（wire §6；§5.2(6)）。" +
    "见 Continue/Submit pending-head 边界行；NOT_OBSERVED 只读行不替代本门控说明。GetResult 须显式点击。" +
    "不宣称可玩首城或生产验收已完成。"
  );
}
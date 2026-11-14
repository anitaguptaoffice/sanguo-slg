import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityGetSucceededHeadBoundaryView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | Readonly<{
      kind: "succeeded-head";
      commandId: string;
      name: string;
      x: number;
      y: number;
      cityId: bigint;
    }>;

/** When durable head is succeeded, loopback GetResult is read-only lookup by owned commandId only. */
export function resolveFirstCityGetSucceededHeadBoundaryView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityGetSucceededHeadBoundaryView {
  if (!knowledge) return { kind: "withheld", reason: "no-knowledge" };
  if (staleActor) return { kind: "withheld", reason: "stale-actor" };
  if (knowledge.unavailable) return { kind: "withheld", reason: "unavailable" };
  if (knowledge.incomplete || knowledge.head === null) return { kind: "withheld", reason: "incomplete" };
  if (knowledge.head.kind === "empty") return { kind: "none" };
  const record = knowledge.head.record;
  if (record.state.kind !== "succeeded") return { kind: "none" };
  const { commandId, name, x, y } = record.intent.proposal;
  return { kind: "succeeded-head", commandId, name, x, y, cityId: record.state.cityId };
}

export function formatFirstCityGetSucceededHeadBoundaryPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityGetSucceededHeadBoundaryView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "Get succeeded-head 边界（只读）：证据冲突或不可用，暂不说明 succeeded head 下的 GetResult 门控；" +
        "不得以 GetResult 推断 competing INITIAL 或推进 head。未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "Get succeeded-head 边界（只读）：证据不完整，暂不说明 succeeded head 下的 GetResult 门控；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  const label = `${view.name} (${view.x},${view.y}) · cityId ${view.cityId}`;
  return (
    `Get succeeded-head 边界（只读）：durable head ${view.commandId} · succeeded · ${label}。` +
    "本 loopback 面板仅对已保留/本地拥有的 commandId 启用显式 V2 GetResult" +
    "（只读，返回 COMMAND 或 NOT_OBSERVED，不接收、不改 head）。" +
    "不得用 GetResult 代替 Submit competing INITIAL 或 Continue 执行（wire §5/§6；§5.2(6)）。" +
    "见 Submit/Continue succeeded-head 边界行；NOT_OBSERVED 只读行不替代本门控说明。GetResult 须显式点击。" +
    "历史 receipt 只读，进入主城须独立 owner 校验；不宣称可玩首城或生产验收已完成。"
  );
}
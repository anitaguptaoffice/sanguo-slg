import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityContinueSucceededHeadBoundaryView =
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

/** When durable head is succeeded, loopback Continue stays PENDING-only; terminal lineage is not re-executed via Continue. */
export function resolveFirstCityContinueSucceededHeadBoundaryView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityContinueSucceededHeadBoundaryView {
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

export function formatFirstCityContinueSucceededHeadBoundaryPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityContinueSucceededHeadBoundaryView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "Continue succeeded-head 边界（只读）：证据冲突或不可用，暂不说明 succeeded head 下的 Continue 门控；" +
        "不得以 Continue 发起执行或推断 PENDING continuation。未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "Continue succeeded-head 边界（只读）：证据不完整，暂不说明 succeeded head 下的 Continue 门控；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  const label = `${view.name} (${view.x},${view.y}) · cityId ${view.cityId}`;
  return (
    `Continue succeeded-head 边界（只读）：durable head ${view.commandId} · succeeded · ${label}。` +
    "本 loopback 面板仅在 PENDING head 下启用 V2 Continue 执行；" +
    "SUCCEEDED 终态不通过 Continue 发起新执行或 PENDING continuation（wire §6；§5.2(7)）。" +
    "历史 receipt 只读，进入主城须独立 owner 校验；须用 Discover/GetResult 读回 COMMAND。" +
    "Continue/Submit 须显式点击。不宣称可玩首城或生产验收已完成。"
  );
}
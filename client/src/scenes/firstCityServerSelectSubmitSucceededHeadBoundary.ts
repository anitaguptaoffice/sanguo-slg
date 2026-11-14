import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCitySubmitSucceededHeadBoundaryView =
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

/** When durable head is succeeded, loopback Submit stays EMPTY-only; competing EMPTY INITIAL is withheld. */
export function resolveFirstCitySubmitSucceededHeadBoundaryView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCitySubmitSucceededHeadBoundaryView {
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

export function formatFirstCitySubmitSucceededHeadBoundaryPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCitySubmitSucceededHeadBoundaryView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "Submit succeeded-head 边界（只读）：证据冲突或不可用，暂不说明 succeeded head 下的 Submit 门控；" +
        "不得以表单自动 Submit 或推断 competing EMPTY INITIAL。未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "Submit succeeded-head 边界（只读）：证据不完整，暂不说明 succeeded head 下的 Submit 门控；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  const label = `${view.name} (${view.x},${view.y}) · cityId ${view.cityId}`;
  return (
    `Submit succeeded-head 边界（只读）：durable head ${view.commandId} · succeeded · ${label}。` +
    "本 loopback 面板仅在 EMPTY head 下启用 V2 Submit（EMPTY predecessor）；" +
    "SUCCEEDED head 拒绝 competing EMPTY INITIAL（wire §5 HEAD_CONFLICT；§5.2(7)）。" +
    "历史 receipt 只读，进入主城须独立 owner 校验；须用 Discover/GetResult 读回 COMMAND。" +
    "Continue/Submit 须显式点击。不宣称可玩首城或生产验收已完成。"
  );
}
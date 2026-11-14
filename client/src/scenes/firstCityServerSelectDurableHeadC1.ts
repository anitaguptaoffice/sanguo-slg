import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityDurableHeadC1View =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | Readonly<{
      kind: "c1";
      commandId: string;
      byteLength: number;
      hexPrefix: string;
      state: "pending" | "succeeded" | "rejected";
    }>;

const C1_HEX_PREFIX_WIDTH = 32;

function hexPrefix(bytes: Uint8Array): string {
  const limit = Math.min(bytes.length, C1_HEX_PREFIX_WIDTH / 2);
  let hex = "";
  for (let index = 0; index < limit; index++) {
    hex += bytes[index]!.toString(16).padStart(2, "0");
  }
  return hex;
}

/** Durable head canonical C1 bytes; distinct from TemplateRef and proposal display fields. */
export function resolveFirstCityDurableHeadC1View(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityDurableHeadC1View {
  if (!knowledge) return { kind: "withheld", reason: "no-knowledge" };
  if (staleActor) return { kind: "withheld", reason: "stale-actor" };
  if (knowledge.unavailable) return { kind: "withheld", reason: "unavailable" };
  if (knowledge.incomplete || knowledge.head === null) return { kind: "withheld", reason: "incomplete" };
  if (knowledge.head.kind === "empty") return { kind: "none" };
  const record = knowledge.head.record;
  const bytes = record.intent.encode();
  return {
    kind: "c1",
    commandId: record.intent.proposal.commandId,
    byteLength: bytes.length,
    hexPrefix: hexPrefix(bytes),
    state: record.state.kind,
  };
}

export function formatFirstCityDurableHeadC1Panel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityDurableHeadC1View(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "durable head C1（只读）：证据冲突或不可用，暂不展示 durable head 的 C1 指纹；" +
        "不得用 proposal 展示字段代替 server 比较的规范字节。未自动 Submit/Continue，未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "durable head C1（只读）：证据不完整，暂不展示 C1 指纹；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  const truncated = view.byteLength > C1_HEX_PREFIX_WIDTH / 2;
  const prefixLabel = truncated ? `hex_prefix=${view.hexPrefix}…` : `hex=${view.hexPrefix}`;
  return (
    `durable head C1（只读）：head ${view.commandId} · ${view.state} · ${view.byteLength} bytes · ${prefixLabel}。` +
    "C1 为 server 比较用的规范字节，不等同于 proposal 展示字段或 TemplateRef；" +
    "同 ID 比较须完整字节一致。Continue/Submit 须显式点击。不宣称可玩首城或生产验收已完成。"
  );
}

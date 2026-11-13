import type { FirstCityHead, FirstCityResponse } from "@/net/firstCityResponseCodec";
import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityNotObservedEntry = Readonly<{
  requestedCommandId: string;
  contextHead:
    | { kind: "empty" }
    | { kind: "command"; commandId: string; name: string; x: number; y: number };
}>;

export type FirstCityNotObservedView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | { kind: "entries"; entries: readonly FirstCityNotObservedEntry[] };

function notObservedObservations(knowledge: FirstCityKnowledge): FirstCityResponse[] {
  return knowledge.observations.filter(value => value.kind === "notObserved");
}

function formatContextHead(head: FirstCityHead): FirstCityNotObservedEntry["contextHead"] {
  if (head.kind === "empty") return { kind: "empty" };
  const proposal = head.record.intent.proposal;
  return {
    kind: "command",
    commandId: proposal.commandId,
    name: proposal.name,
    x: proposal.x,
    y: proposal.y,
  };
}

function collectNotObserved(knowledge: FirstCityKnowledge): FirstCityNotObservedEntry[] {
  const byRequest = new Map<string, FirstCityNotObservedEntry>();
  for (const observation of notObservedObservations(knowledge)) {
    if (observation.kind !== "notObserved") continue;
    const requestedCommandId = observation.requestedCommandId;
    byRequest.set(requestedCommandId, {
      requestedCommandId,
      contextHead: formatContextHead(observation.head),
    });
  }
  return [...byRequest.values()].sort((a, b) =>
    a.requestedCommandId < b.requestedCommandId ? -1 : a.requestedCommandId > b.requestedCommandId ? 1 : 0,
  );
}

/** Retained command lookup NOT_OBSERVED; distinct from actor discovery EMPTY (see canonical winner). */
export function resolveFirstCityNotObservedView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityNotObservedView {
  if (!knowledge) return { kind: "withheld", reason: "no-knowledge" };
  if (staleActor) return { kind: "withheld", reason: "stale-actor" };
  if (knowledge.unavailable) return { kind: "withheld", reason: "unavailable" };
  if (knowledge.incomplete || knowledge.head === null) return { kind: "withheld", reason: "incomplete" };
  const entries = collectNotObserved(knowledge);
  return entries.length ? { kind: "entries", entries } : { kind: "none" };
}

export function formatFirstCityNotObservedPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityNotObservedView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return "NOT_OBSERVED（只读）：证据不可用，暂不展示按 ID 查找未命中；不得把 lookup miss 当作 actor EMPTY 或自动 Submit。未进入主城。";
    }
    if (view.reason === "incomplete") {
      return "NOT_OBSERVED（只读）：证据不完整，暂不展示按 ID 查找未命中；须保留本地记录并显式 Discover/GetResult。未进入主城。";
    }
    return "";
  }
  if (view.kind === "none") return "";
  const lines = view.entries.map(entry => {
    const context =
      entry.contextHead.kind === "empty"
        ? "响应时 durable head：EMPTY"
        : `响应时 durable head：${entry.contextHead.commandId} · ${entry.contextHead.name} (${entry.contextHead.x},${entry.contextHead.y})`;
    return `查找 ${entry.requestedCommandId} · ${context}`;
  });
  return (
    `NOT_OBSERVED 查找（只读）：${lines.join("；")}。` +
    "按 commandId 权威读未见记录，不是 actor discovery 的 EMPTY；不推断旧包失败。Continue/Submit 须显式点击。不宣称可玩首城。"
  );
}

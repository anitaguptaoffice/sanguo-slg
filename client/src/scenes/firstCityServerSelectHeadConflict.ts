import type { FirstCityHead, FirstCityResponse } from "@/net/firstCityResponseCodec";
import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityHeadConflictEntry = Readonly<{
  requestedCommandId: string;
  actual:
    | { kind: "empty" }
    | { kind: "command"; commandId: string; name: string; x: number; y: number };
}>;

export type FirstCityHeadConflictView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | { kind: "entries"; entries: readonly FirstCityHeadConflictEntry[] };

function headConflictObservations(knowledge: FirstCityKnowledge): FirstCityResponse[] {
  return knowledge.observations.filter(value => value.kind === "headConflict");
}

function formatActualHead(head: FirstCityHead): FirstCityHeadConflictEntry["actual"] {
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

function collectHeadConflicts(knowledge: FirstCityKnowledge): FirstCityHeadConflictEntry[] {
  const byRequest = new Map<string, FirstCityHeadConflictEntry>();
  for (const observation of headConflictObservations(knowledge)) {
    if (observation.kind !== "headConflict") continue;
    const requestedCommandId = observation.requestedCommandId;
    byRequest.set(requestedCommandId, {
      requestedCommandId,
      actual: formatActualHead(observation.head),
    });
  }
  return [...byRequest.values()].sort((a, b) =>
    a.requestedCommandId < b.requestedCommandId ? -1 : a.requestedCommandId > b.requestedCommandId ? 1 : 0,
  );
}

/** Retained Submit/Continue HEAD_CONFLICT outcomes; never promotes a losing request to canonical head. */
export function resolveFirstCityHeadConflictView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityHeadConflictView {
  if (!knowledge) return { kind: "withheld", reason: "no-knowledge" };
  if (staleActor) return { kind: "withheld", reason: "stale-actor" };
  if (knowledge.unavailable) return { kind: "withheld", reason: "unavailable" };
  if (knowledge.incomplete || knowledge.head === null) return { kind: "withheld", reason: "incomplete" };
  const entries = collectHeadConflicts(knowledge);
  return entries.length ? { kind: "entries", entries } : { kind: "none" };
}

export function formatFirstCityHeadConflictPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityHeadConflictView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return "HEAD_CONFLICT（只读）：证据冲突或不可用，暂不展示摄入冲突；不得用失败请求替代规范胜者或自动 Continue。未进入主城。";
    }
    if (view.reason === "incomplete") {
      return "HEAD_CONFLICT（只读）：证据不完整，暂不展示摄入冲突；须保留本地记录并对规范胜者显式 Continue。未进入主城。";
    }
    return "";
  }
  if (view.kind === "none") return "";
  const lines = view.entries.map(entry => {
    const actual =
      entry.actual.kind === "empty"
        ? "实际 head：EMPTY"
        : `实际 head：${entry.actual.commandId} · ${entry.actual.name} (${entry.actual.x},${entry.actual.y})`;
    return `请求 ${entry.requestedCommandId} · ${actual}`;
  });
  return (
    `HEAD_CONFLICT 摄入（只读）：${lines.join("；")}。` +
    "本次提交未执行胜者；Continue 须显式点击且仅延续 durable head。不宣称可玩首城。"
  );
}

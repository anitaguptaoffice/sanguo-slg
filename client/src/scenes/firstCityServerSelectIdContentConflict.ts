import type { FirstCityRecord } from "@/net/firstCityResponseCodec";
import type { FirstCityResponse } from "@/net/firstCityResponseCodec";
import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityIdContentConflictEntry = Readonly<{
  requestedCommandId: string;
  retained: { commandId: string; name: string; x: number; y: number };
}>;

export type FirstCityIdContentConflictView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | { kind: "entries"; entries: readonly FirstCityIdContentConflictEntry[] };

function idContentConflictObservations(knowledge: FirstCityKnowledge): FirstCityResponse[] {
  return knowledge.observations.filter(value => value.kind === "idContentConflict");
}

function formatRetainedRecord(record: FirstCityRecord): FirstCityIdContentConflictEntry["retained"] {
  const proposal = record.intent.proposal;
  return {
    commandId: proposal.commandId,
    name: proposal.name,
    x: proposal.x,
    y: proposal.y,
  };
}

function collectIdContentConflicts(knowledge: FirstCityKnowledge): FirstCityIdContentConflictEntry[] {
  const byRequest = new Map<string, FirstCityIdContentConflictEntry>();
  for (const observation of idContentConflictObservations(knowledge)) {
    if (observation.kind !== "idContentConflict" || !observation.command) continue;
    const requestedCommandId = observation.requestedCommandId;
    byRequest.set(requestedCommandId, {
      requestedCommandId,
      retained: formatRetainedRecord(observation.command),
    });
  }
  return [...byRequest.values()].sort((a, b) =>
    a.requestedCommandId < b.requestedCommandId ? -1 : a.requestedCommandId > b.requestedCommandId ? 1 : 0,
  );
}

/** Retained Submit/Continue ID_CONTENT_CONFLICT outcomes; shows server original record, never the conflicting proposal. */
export function resolveFirstCityIdContentConflictView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityIdContentConflictView {
  if (!knowledge) return { kind: "withheld", reason: "no-knowledge" };
  if (staleActor) return { kind: "withheld", reason: "stale-actor" };
  if (knowledge.unavailable) return { kind: "withheld", reason: "unavailable" };
  if (knowledge.incomplete || knowledge.head === null) return { kind: "withheld", reason: "incomplete" };
  const entries = collectIdContentConflicts(knowledge);
  return entries.length ? { kind: "entries", entries } : { kind: "none" };
}

export function formatFirstCityIdContentConflictPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityIdContentConflictView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return "ID_CONTENT_CONFLICT（只读）：证据冲突或不可用，暂不展示同 ID 内容冲突；不得用冲突提案替代 server 原始记录或自动 Continue。未进入主城。";
    }
    if (view.reason === "incomplete") {
      return "ID_CONTENT_CONFLICT（只读）：证据不完整，暂不展示同 ID 内容冲突；须保留本地记录并对 durable 记录显式 Continue。未进入主城。";
    }
    return "";
  }
  if (view.kind === "none") return "";
  const lines = view.entries.map(entry =>
    `请求 ${entry.requestedCommandId} · server 原始记录：${entry.retained.name} (${entry.retained.x},${entry.retained.y})`,
  );
  return (
    `ID_CONTENT_CONFLICT 摄入（只读）：${lines.join("；")}。` +
    "展示的是 server 保留记录，不是本次冲突提案；Continue/Submit 须显式点击。不宣称可玩首城。"
  );
}

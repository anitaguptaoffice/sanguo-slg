import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";
import type { FirstCityRecord, FirstCityResponse } from "@/net/firstCityResponseCodec";

export type FirstCityCommandOutcomeEntry = Readonly<{
  requestedCommandId: string;
  record:
    | { kind: "record"; commandId: string; name: string; x: number; y: number; state: "pending" | "succeeded" | "rejected" }
    | { kind: "missing" };
}>;

export type FirstCityCommandOutcomeView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | { kind: "entries"; entries: readonly FirstCityCommandOutcomeEntry[] };

function commandOutcomeObservations(knowledge: FirstCityKnowledge): FirstCityResponse[] {
  return knowledge.observations.filter(value => value.kind === "command");
}

function formatRecord(record: FirstCityRecord): FirstCityCommandOutcomeEntry["record"] {
  const { commandId, name, x, y } = record.intent.proposal;
  return {
    kind: "record",
    commandId,
    name,
    x,
    y,
    state: record.state.kind,
  };
}

function collectCommandOutcomes(knowledge: FirstCityKnowledge): FirstCityCommandOutcomeEntry[] {
  const byRequest = new Map<string, FirstCityCommandOutcomeEntry>();
  for (const observation of commandOutcomeObservations(knowledge)) {
    if (observation.kind !== "command") continue;
    const requestedCommandId = observation.requestedCommandId;
    byRequest.set(requestedCommandId, {
      requestedCommandId,
      record: observation.command ? formatRecord(observation.command) : { kind: "missing" },
    });
  }
  return [...byRequest.values()].sort((a, b) =>
    a.requestedCommandId < b.requestedCommandId ? -1 : a.requestedCommandId > b.requestedCommandId ? 1 : 0,
  );
}

/** Retained Submit/Continue/GetResult COMMAND read-only playback; distinct from discovery head / NOT_OBSERVED. */
export function resolveFirstCityCommandOutcomeView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityCommandOutcomeView {
  if (!knowledge) return { kind: "withheld", reason: "no-knowledge" };
  if (staleActor) return { kind: "withheld", reason: "stale-actor" };
  if (knowledge.unavailable) return { kind: "withheld", reason: "unavailable" };
  if (knowledge.incomplete || knowledge.head === null) return { kind: "withheld", reason: "incomplete" };
  const entries = collectCommandOutcomes(knowledge);
  return entries.length ? { kind: "entries", entries } : { kind: "none" };
}

export function formatFirstCityCommandOutcomePanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityCommandOutcomeView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return "COMMAND 回放（只读）：证据不可用，暂不展示 Submit/Continue/GetResult 的只读 COMMAND；不得把回放当作新摄入或自动 Continue。未进入主城。";
    }
    if (view.reason === "incomplete") {
      return "COMMAND 回放（只读）：证据不完整，暂不展示 COMMAND outcome；须保留本地记录并显式 Discover/GetResult。未进入主城。";
    }
    return "";
  }
  if (view.kind === "none") return "";
  const lines = view.entries.map(entry => {
    if (entry.record.kind === "missing") {
      return `请求 ${entry.requestedCommandId} · server 未附保留记录`;
    }
    const { commandId, name, x, y, state } = entry.record;
    return `请求 ${entry.requestedCommandId} · 保留 ${commandId} · ${name} (${x},${y}) · ${state}`;
  });
  return (
    `COMMAND 回放（只读）：${lines.join("；")}。` +
    "同 ID 同内容的只读回放或已知终态返还不是新摄入；不是 NOT_OBSERVED 或 actor discovery EMPTY。" +
    "Continue/Submit 须显式点击。不宣称可玩首城或生产验收已完成。"
  );
}

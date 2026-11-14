import type { FirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityLocalDraftDivergence = Readonly<{
  commandId: string;
  localName: string;
  localX: number;
  localY: number;
  serverName: string;
  serverX: number;
  serverY: number;
}>;

export type FirstCityLocalDraftView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | { kind: "entries"; entries: readonly FirstCityLocalDraftDivergence[] };

function proposalBody(intent: FirstCityIntent): string {
  const proposal = intent.proposal;
  return JSON.stringify({
    commandId: proposal.commandId,
    predecessor: proposal.predecessor,
    name: proposal.name,
    x: proposal.x,
    y: proposal.y,
  });
}

function collectSameIdDivergences(knowledge: FirstCityKnowledge): FirstCityLocalDraftDivergence[] {
  const records = new Map(knowledge.records.map(record => [record.intent.proposal.commandId, record]));
  const entries: FirstCityLocalDraftDivergence[] = [];
  for (const local of knowledge.intents) {
    const commandId = local.proposal.commandId;
    const record = records.get(commandId);
    if (!record) continue;
    if (proposalBody(local) === proposalBody(record.intent)) continue;
    entries.push({
      commandId,
      localName: local.proposal.name,
      localX: local.proposal.x,
      localY: local.proposal.y,
      serverName: record.intent.proposal.name,
      serverX: record.intent.proposal.x,
      serverY: record.intent.proposal.y,
    });
  }
  return entries.sort((a, b) => (a.commandId < b.commandId ? -1 : a.commandId > b.commandId ? 1 : 0));
}

/** Same-ID local/server divergence; never promotes local draft over durable head record. */
export function resolveFirstCityLocalDraftView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityLocalDraftView {
  if (!knowledge) return { kind: "withheld", reason: "no-knowledge" };
  if (staleActor) return { kind: "withheld", reason: "stale-actor" };
  if (knowledge.unavailable) return { kind: "withheld", reason: "unavailable" };
  if (knowledge.incomplete || knowledge.head === null) return { kind: "withheld", reason: "incomplete" };
  const entries = collectSameIdDivergences(knowledge);
  return entries.length ? { kind: "entries", entries } : { kind: "none" };
}

export function formatFirstCityLocalDraftPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityLocalDraftView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return "同 ID 本地草案（只读）：证据冲突或不可用，暂不展示分歧行；不得用本地草案替代规范胜者或自动 Continue。未进入主城。";
    }
    if (view.reason === "incomplete") {
      return "同 ID 本地草案（只读）：证据不完整，暂不展示分歧；须保留本地记录并对规范胜者显式 Continue。未进入主城。";
    }
    return "";
  }
  if (view.kind === "none") return "";
  const lines = view.entries.map(entry => {
    return (
      `${entry.commandId} · 本地 ${entry.localName} (${entry.localX},${entry.localY})` +
      ` · server ${entry.serverName} (${entry.serverX},${entry.serverY})`
    );
  });
  return (
    `同 ID 本地草案分歧（只读）：${lines.join("；")}。` +
    "本地草案不升格为规范胜者；Continue/Submit 须显式点击且仅延续 durable head。不宣称可玩首城。"
  );
}

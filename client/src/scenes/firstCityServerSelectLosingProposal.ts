import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityLosingProposalEntry = Readonly<{
  commandId: string;
  name: string;
  x: number;
  y: number;
  source: "local" | "server";
}>;

export type FirstCityLosingProposalsView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | { kind: "entries"; entries: readonly FirstCityLosingProposalEntry[] };

function canonicalHeadId(knowledge: FirstCityKnowledge): string | null {
  if (knowledge.head?.kind === "command") return knowledge.head.record.intent.proposal.commandId;
  return null;
}

function collectLosingProposals(knowledge: FirstCityKnowledge): FirstCityLosingProposalEntry[] {
  const headId = canonicalHeadId(knowledge);
  const byId = new Map<string, FirstCityLosingProposalEntry>();
  for (const record of knowledge.records) {
    const id = record.intent.proposal.commandId;
    if (headId !== null && id === headId) continue;
    byId.set(id, {
      commandId: id,
      name: record.intent.proposal.name,
      x: record.intent.proposal.x,
      y: record.intent.proposal.y,
      source: "server",
    });
  }
  for (const intent of knowledge.intents) {
    const id = intent.proposal.commandId;
    if (headId !== null && id === headId) continue;
    if (byId.has(id)) continue;
    byId.set(id, {
      commandId: id,
      name: intent.proposal.name,
      x: intent.proposal.x,
      y: intent.proposal.y,
      source: "local",
    });
  }
  return [...byId.values()].sort((a, b) => (a.commandId < b.commandId ? -1 : a.commandId > b.commandId ? 1 : 0));
}

/** Non-head locals/records for §11 loser display; never promotes a loser to canonical winner. */
export function resolveFirstCityLosingProposalsView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityLosingProposalsView {
  if (!knowledge) return { kind: "withheld", reason: "no-knowledge" };
  if (staleActor) return { kind: "withheld", reason: "stale-actor" };
  if (knowledge.unavailable) return { kind: "withheld", reason: "unavailable" };
  if (knowledge.incomplete || knowledge.head === null) return { kind: "withheld", reason: "incomplete" };
  const entries = collectLosingProposals(knowledge);
  return entries.length ? { kind: "entries", entries } : { kind: "none" };
}

export function formatFirstCityLosingProposalsPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityLosingProposalsView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return "未胜出提案（只读）：证据冲突或不可用，暂不列举 loser；不得据此自动 Continue。未进入主城。";
    }
    if (view.reason === "incomplete") {
      return "未胜出提案（只读）：证据不完整，暂不列举 loser；须保留本地记录并对规范胜者显式 Continue。未进入主城。";
    }
    return "";
  }
  if (view.kind === "none") return "";
  const lines = view.entries.map((entry: FirstCityLosingProposalEntry) => {
    const tag = entry.source === "local" ? "本地草案" : "server 记录";
    return `${entry.commandId} · ${entry.name} (${entry.x},${entry.y}) · ${tag}`;
  });
  return (
    `未胜出提案（只读）：${lines.join("；")}。` +
    "不得以 loser 内容替代规范胜者；Continue/Submit 须显式点击且仅延续当前 head。不宣称可玩首城。"
  );
}

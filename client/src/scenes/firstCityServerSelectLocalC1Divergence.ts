import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityLocalC1DivergenceEntry = Readonly<{
  commandId: string;
  localByteLength: number;
  localHexPrefix: string;
  serverByteLength: number;
  serverHexPrefix: string;
}>;

export type FirstCityLocalC1DivergenceView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | { kind: "entries"; entries: readonly FirstCityLocalC1DivergenceEntry[] };

const HEX_PREFIX_WIDTH = 32;

function hexPrefix(bytes: Uint8Array): string {
  const limit = Math.min(bytes.length, HEX_PREFIX_WIDTH / 2);
  let hex = "";
  for (let index = 0; index < limit; index++) {
    hex += bytes[index]!.toString(16).padStart(2, "0");
  }
  return hex;
}

function c1Fingerprint(bytes: Uint8Array): Pick<FirstCityLocalC1DivergenceEntry, "localByteLength" | "localHexPrefix"> {
  return { localByteLength: bytes.length, localHexPrefix: hexPrefix(bytes) };
}

function collectDivergences(knowledge: FirstCityKnowledge): FirstCityLocalC1DivergenceEntry[] {
  const records = new Map(knowledge.records.map(record => [record.intent.proposal.commandId, record]));
  const entries: FirstCityLocalC1DivergenceEntry[] = [];
  for (const local of knowledge.intents) {
    const commandId = local.proposal.commandId;
    const record = records.get(commandId);
    if (!record) continue;
    const serverBytes = record.intent.encode();
    if (local.matches(serverBytes)) continue;
    const localPrint = c1Fingerprint(local.encode());
    const serverPrint = c1Fingerprint(serverBytes);
    entries.push({
      commandId,
      localByteLength: localPrint.localByteLength,
      localHexPrefix: localPrint.localHexPrefix,
      serverByteLength: serverPrint.localByteLength,
      serverHexPrefix: serverPrint.localHexPrefix,
    });
  }
  return entries.sort((a, b) => (a.commandId < b.commandId ? -1 : a.commandId > b.commandId ? 1 : 0));
}

/** Same-ID local vs server retained C1 bytes; distinct from proposal-field local draft and durable head C1 row. */
export function resolveFirstCityLocalC1DivergenceView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityLocalC1DivergenceView {
  if (!knowledge) return { kind: "withheld", reason: "no-knowledge" };
  if (staleActor) return { kind: "withheld", reason: "stale-actor" };
  if (knowledge.unavailable) return { kind: "withheld", reason: "unavailable" };
  if (knowledge.incomplete || knowledge.head === null) return { kind: "withheld", reason: "incomplete" };
  const entries = collectDivergences(knowledge);
  return entries.length ? { kind: "entries", entries } : { kind: "none" };
}

export function formatFirstCityLocalC1DivergencePanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityLocalC1DivergenceView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "同 ID 本地 C1（只读）：证据冲突或不可用，暂不展示本地与 server 保留记录的 C1 字节分歧；" +
        "不得把本地草案当作规范胜者或自动 Continue。未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "同 ID 本地 C1（只读）：证据不完整，暂不展示 C1 分歧；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  const lines = view.entries.map(entry => {
    const localLabel = `本地 ${entry.localByteLength}b · ${entry.localHexPrefix}`;
    const serverLabel = `server ${entry.serverByteLength}b · ${entry.serverHexPrefix}`;
    return `${entry.commandId} · ${localLabel} ≠ ${serverLabel}`;
  });
  return (
    `同 ID 本地 C1 分歧（只读）：${lines.join("；")}。` +
    "以完整 C1 字节为准（含 scope/operation），不等同于 proposal 展示字段或 durable head 单行指纹；" +
    "本地不升格为规范胜者。Continue/Submit 须显式点击。不宣称可玩首城或生产验收已完成。"
  );
}
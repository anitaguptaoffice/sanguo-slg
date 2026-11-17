import { createFirstCityIntent, validateFirstCityScope } from "./firstCityCanonical";
import type { FirstCityIntent, FirstCityScope } from "./firstCityCanonical";
import type { FirstCityHead, FirstCityRecord, FirstCityResponse } from "./firstCityResponseCodec";

export type FirstCityEvidence = Readonly<{
  intents: readonly FirstCityIntent[];
  observations: readonly FirstCityResponse[];
  unavailable: boolean;
}>;
export type FirstCityKnowledge = FirstCityEvidence & Readonly<{
  scope: FirstCityScope;
  records: readonly FirstCityRecord[];
  head: FirstCityHead | null;
  incomplete: boolean;
}>;
const stamp = (value: unknown): string => JSON.stringify(value, (_, v) => typeof v === "bigint" ? String(v) : v);
const id = (record: FirstCityRecord): string => record.intent.proposal.commandId;
function unique<T>(values: readonly T[]): T[] {
  const entries = new Map<string, T>();
  for (const value of values) if (!entries.has(stamp(value))) entries.set(stamp(value), value);
  return [...entries].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, value]) => value);
}
const empty = Object.freeze({ kind: "empty" } as const);

/** Empty local knowledge is neither authoritative EMPTY nor permission to submit. */
export function createFirstCityKnowledge(scope: FirstCityScope): FirstCityKnowledge {
  return Object.freeze({ scope: validateFirstCityScope(scope), intents: Object.freeze([]),
    observations: Object.freeze([]), records: Object.freeze([]), head: null, incomplete: false, unavailable: false });
}

/** Inputs must come from the validated codec/Gateway/journal; this is not an authentication boundary. */
export function reduceFirstCityKnowledge(previous: FirstCityKnowledge, evidence: FirstCityEvidence): FirstCityKnowledge {
  const scope = validateFirstCityScope(previous.scope);
  let unavailable = previous.unavailable || evidence.unavailable;
  const checkScope = (value: FirstCityScope) => {
    if (stamp(validateFirstCityScope(value)) !== stamp(scope)) throw new TypeError("Different first-city scope");
  };
  const intent = (value: FirstCityIntent): FirstCityIntent => {
    checkScope(value.scope);
    return createFirstCityIntent(value.scope, value.proposal);
  };
  const record = (value: FirstCityRecord): FirstCityRecord => Object.freeze({ intent: intent(value.intent),
    template: Object.freeze({ ...value.template }), state: Object.freeze({ ...value.state }) });
  const locals = [...previous.intents];
  const observations = [...previous.observations];
  for (const value of evidence.intents) {
    try { locals.push(intent(value)); } catch { unavailable = true; }
  }
  for (const value of evidence.observations) {
    try {
      checkScope(value.scope);
      const head: FirstCityHead = value.head.kind === "empty" ? empty :
        Object.freeze({ kind: "command", record: record(value.head.record) });
      observations.push(Object.freeze(value.kind === "discovery" ? { kind: value.kind, scope, head } :
        { kind: value.kind, scope, head, requestedCommandId: value.requestedCommandId,
          command: value.command ? record(value.command) : null }));
    } catch { unavailable = true; }
  }
  const retained = unique(observations);
  const all = unique(retained.flatMap(value => [
    ...(value.head.kind === "command" ? [value.head.record] : []),
    ...(value.kind !== "discovery" && value.command ? [value.command] : []),
  ]));
  const groups = new Map<string, FirstCityRecord[]>();
  for (const value of all) groups.set(id(value), [...(groups.get(id(value)) ?? []), value]);
  const records: FirstCityRecord[] = [];
  const current = new Map<string, FirstCityRecord>();
  for (const [key, values] of groups) {
    const identities = unique(values.map(value => ({ intent: value.intent, template: value.template })));
    const terminals = values.filter(value => value.state.kind !== "pending");
    if (identities.length > 1 || unique(terminals.map(value => value.state)).length > 1) {
      unavailable = true;
      records.push(...values); // Never choose one contradictory receipt and discard the other.
    } else records.push(terminals[0] ?? values[0]);
    current.set(key, terminals[0] ?? values[0]);
  }
  const edges = new Map<string, Set<string>>();
  const edge = (older: string, newer: string, graph = edges) => {
    if (!graph.has(older)) graph.set(older, new Set());
    graph.get(older)!.add(newer);
  };
  const children = new Map<string, Set<string>>();
  const parents = new Map<string, string>();
  for (const value of all) {
    const predecessor = value.intent.proposal.predecessor;
    const parent = predecessor.kind === "empty" ? "EMPTY" : predecessor.commandId;
    if (!children.has(parent)) children.set(parent, new Set());
    children.get(parent)!.add(id(value));
    parents.set(id(value), parent);
    edge(parent, id(value));
  }
  for (const siblings of children.values()) if (siblings.size > 1) unavailable = true;
  const root = (key: string): string => {
    const seen = new Set<string>();
    while (parents.has(key) && !seen.has(key)) { seen.add(key); key = parents.get(key)!; }
    return key;
  };
  // Exact predecessor chains are contiguous: history cannot insert another chain between neighbors.
  const blocks = new Map<string, Set<string>>();
  const heads = new Set<string>();
  for (const value of retained) if (value.head.kind === "command") {
    const headId = id(value.head.record);
    heads.add(headId);
    // One validated response also orders a historical rejection across missing intermediate records.
    if (value.kind !== "discovery" && value.command && id(value.command) !== headId) {
      edge(id(value.command), headId);
      const older = root(id(value.command)), newer = root(headId);
      if (older !== newer) edge(older, newer, blocks);
      if (older !== newer && newer === "EMPTY") unavailable = true;
    }
  }
  const reaches = (older: string, newer: string, graph = edges): boolean => {
    const todo = [...(graph.get(older) ?? [])], seen = new Set<string>();
    while (todo.length) {
      const next = todo.pop()!;
      if (next === newer) return true;
      if (seen.has(next)) continue;
      seen.add(next);
      todo.push(...(graph.get(next) ?? []));
    }
    return false;
  };
  for (const graph of [edges, blocks]) for (const key of graph.keys()) if (reaches(key, key, graph)) unavailable = true;
  const successes = [...current.values()].filter(value => value.state.kind === "succeeded");
  if (successes.length > 1 || successes.some(value => edges.has(id(value)) || blocks.has(root(id(value))))) unavailable = true;
  // A complete EMPTY-to-success chain leaves no place for any other accepted block.
  if (successes.some(value => root(id(value)) === "EMPTY") && [...current.keys()].some(key => root(key) !== "EMPTY")) unavailable = true;
  const before = (a: string, b: string) => root(a) === root(b) ? reaches(a, b) : reaches(root(a), root(b), blocks);
  const candidates = [...heads].filter(key => ![...heads].some(other => other !== key && before(key, other)));
  const incomplete = heads.size > 0 && candidates.length !== 1;
  const head: FirstCityHead | null = unavailable || incomplete ? null : candidates.length ?
    Object.freeze({ kind: "command", record: current.get(candidates[0])! }) : retained.length ? empty : null;
  return Object.freeze({ scope, intents: Object.freeze(unique(locals)), observations: Object.freeze(retained),
    records: Object.freeze(unique(records)), head, incomplete, unavailable });
}

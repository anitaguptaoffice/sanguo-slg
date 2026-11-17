import { createFirstCityIntent, validateFirstCityScope, validateFirstCityUuid } from "./firstCityCanonical";
import type { FirstCityIntent, FirstCityScope } from "./firstCityCanonical";
import { decodeFirstCityRequest, encodeFirstCityRequest } from "./firstCityRequestCodec";
import { decodeFirstCityResponse } from "./firstCityResponseCodec";
import type { FirstCityResponse } from "./firstCityResponseCodec";
import { firstCityUnknown } from "./firstCityPacket";

type Entry = Readonly<{ text: string; intent?: FirstCityIntent; response?: FirstCityResponse }>;
export type FirstCityHistory = Readonly<{
  intents: readonly FirstCityIntent[];
  observations: readonly FirstCityResponse[];
  unavailable: boolean;
}>;
const submit = "world.v2.SubmitFirstCity";
const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
function bytes(value: unknown, maximum: number): Uint8Array {
  if (typeof value !== "string" || value.length > maximum * 2 || !/^(?:[0-9a-f]{2})*$/.test(value)) throw firstCityUnknown();
  return Uint8Array.from(value.match(/../g) ?? [], part => parseInt(part, 16));
}
function prefix(value: FirstCityScope): string {
  const s = validateFirstCityScope(value);
  return `sanguo:first-city:v1:${s.realmId}:${s.shard}:${s.playerId}:${s.accountId}:`;
}
function parse(text: string, scopeKey: string): Entry {
  if (typeof text !== "string" || text.length > 34000) throw firstCityUnknown();
  const value = JSON.parse(text);
  const { version, kind, route, data, c1 } = value ?? {};
  if (version !== 1 || JSON.stringify({ version, kind, route, data, c1 }) !== text) throw firstCityUnknown();
  if (kind === "intent" && (route === submit || route === "world.v2.ContinueFirstCity")) {
    const request = decodeFirstCityRequest(route, bytes(data, 2048));
    if (!("expectedScope" in request) || !("proposal" in request)) throw firstCityUnknown();
    const intent = createFirstCityIntent(request.expectedScope, request.proposal);
    if (prefix(intent.scope) !== scopeKey || !intent.matches(bytes(c1, 231))) throw firstCityUnknown();
    return Object.freeze({ text, intent });
  }
  if (kind !== "response" || c1 !== null) throw firstCityUnknown();
  const response = decodeFirstCityResponse(route, bytes(data, 16384));
  if (prefix(response.scope) !== scopeKey) throw firstCityUnknown();
  return Object.freeze({ text, response });
}

/** Append-only local evidence, not server authority or proposal/continuation policy. */
export class FirstCityJournal {
  private readonly entries = new Map<string, Entry>();
  private readonly retained = new Map<string, Entry>();
  private readonly unavailable = new Set<string>();
  constructor(private readonly storage: () => Storage = () => globalThis.localStorage) {}

  read(scope: FirstCityScope): FirstCityHistory {
    const scopeKey = prefix(scope);
    try {
      const storage = this.storage();
      const keys = new Set<string>();
      for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index);
        if (key?.startsWith(scopeKey)) keys.add(key);
      }
      // Recheck remembered keys even if enumeration missed a concurrent removal.
      for (const key of this.entries.keys()) if (key.startsWith(scopeKey)) keys.add(key);
      for (const key of keys) {
        try {
          validateFirstCityUuid(key.slice(scopeKey.length));
          const text = storage.getItem(key);
          const previous = this.entries.get(key);
          if (text === null || (previous && previous.text !== text)) throw firstCityUnknown();
          const entry = parse(text, scopeKey);
          this.entries.set(key, entry);
          this.retained.set(scopeKey + text, entry);
        } catch { this.unavailable.add(scopeKey); }
      }
    } catch { this.unavailable.add(scopeKey); }
    const retained = [...this.retained].filter(([key]) => key.startsWith(scopeKey)).map(([, value]) => value);
    return Object.freeze({
      intents: Object.freeze(retained.flatMap(entry => entry.intent ? [entry.intent] : [])),
      observations: Object.freeze(retained.flatMap(entry => entry.response ? [entry.response] : [])),
      unavailable: this.unavailable.has(scopeKey),
    });
  }

  private save(scope: FirstCityScope, text: string): Entry {
    const scopeKey = prefix(scope);
    const entry = parse(text, scopeKey);
    const history = this.read(scope);
    // Keep learned evidence even if storage fails after a valid terminal response.
    this.retained.set(scopeKey + text, entry);
    try {
      if (history.unavailable) throw firstCityUnknown();
      const existing = [...this.entries].find(([key, value]) => key.startsWith(scopeKey) && value.text === text);
      const key = existing?.[0] ?? scopeKey + validateFirstCityUuid(crypto.randomUUID());
      if (this.entries.has(key) && this.entries.get(key)!.text !== text) throw firstCityUnknown();
      this.entries.set(key, entry);
      const storage = this.storage();
      const previous = storage.getItem(key);
      if (previous !== null && previous !== text) throw firstCityUnknown();
      if (previous === null) storage.setItem(key, text);
      const readback = storage.getItem(key);
      if (readback !== text) throw firstCityUnknown();
      return parse(readback, scopeKey);
    } catch {
      this.unavailable.add(scopeKey);
      throw firstCityUnknown();
    }
  }

  prepare(route: string, original: FirstCityIntent): FirstCityIntent {
    const intent = createFirstCityIntent(original.scope, original.proposal);
    const data = encodeFirstCityRequest(route, { expectedScope: intent.scope, proposal: intent.proposal });
    const saved = this.save(intent.scope, JSON.stringify({ version: 1, kind: "intent", route,
      data: hex(data), c1: hex(intent.encode()) })).intent!;
    if (!intent.matches(saved.encode())) throw firstCityUnknown();
    return saved;
  }

  observe(route: string, data: Uint8Array): void {
    const response = decodeFirstCityResponse(route, data);
    this.save(response.scope, JSON.stringify({ version: 1, kind: "response", route, data: hex(data), c1: null }));
  }
}

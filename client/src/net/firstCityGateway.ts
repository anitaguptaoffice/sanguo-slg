import { createFirstCityIntent } from "./firstCityCanonical";
import type { FirstCityIntent, FirstCityScope } from "./firstCityCanonical";
import { encodeFirstCityRequest, decodeFirstCityRequest } from "./firstCityRequestCodec";
import { decodeFirstCityResponse } from "./firstCityResponseCodec";
import type { FirstCityResponse } from "./firstCityResponseCodec";
import { firstCityPacket, readFirstCityPacket, firstCityUnknown } from "./firstCityPacket";

export type FirstCityRoute = `world.v2.${"DiscoverFirstCityIntent" | "SubmitFirstCity" | "ContinueFirstCity" | "GetFirstCityResult"}`;
export type FirstCityCallOptions = { signal?: AbortSignal; timeoutMs?: number; knownIntent?: Pick<FirstCityIntent, "scope" | "proposal"> };
type Context = { ws: WebSocket | null; session: string; shard: number; generation: number };
const sameScope = (a: FirstCityScope, b: FirstCityScope) => a.realmId === b.realmId && a.shard === b.shard &&
  a.playerId === b.playerId && a.accountId === b.accountId;

/** Local correlation only; no journal, UUID allocation, retry or execution policy. */
export class FirstCityGateway {
  private scope: FirstCityScope | null = null;
  private pending = new Set<() => void>();
  constructor(private readonly context: () => Context | null) {}

  reset(): void {
    this.scope = null;
    for (const cancel of [...this.pending]) cancel();
  }

  async request(route: FirstCityRoute, value: unknown, options: FirstCityCallOptions = {}): Promise<FirstCityResponse> {
    try {
      const { signal, timeoutMs, knownIntent } = options;
      const payload = encodeFirstCityRequest(route, value);
      const request = decodeFirstCityRequest(route, payload);
      const discovery = route === "world.v2.DiscoverFirstCityIntent";
      const original = "proposal" in request ? createFirstCityIntent(request.expectedScope, request.proposal) :
        knownIntent ? createFirstCityIntent(knownIntent.scope, knownIntent.proposal) : null;
      const commandId = "commandId" in request ? request.commandId : original?.proposal.commandId;
      const context = this.context();
      const ws = context?.ws;
      const timeout = timeoutMs ?? 15_000;
      if (!context || !ws || ws.readyState !== WebSocket.OPEN || signal?.aborted ||
        !Number.isInteger(timeout) || timeout < 1 || timeout > 2147483647) throw firstCityUnknown();
      const trace = crypto.randomUUID();
      const packet = firstCityPacket(route, payload, trace, context.session, context.shard);
      if (discovery) this.reset();
      else if (!("expectedScope" in request) || !this.scope || !sameScope(request.expectedScope, this.scope) ||
        (original && (!sameScope(original.scope, this.scope) || original.proposal.commandId !== commandId))) throw firstCityUnknown();
      const scope = this.scope;
      const current = () => {
        const now = this.context();
        return now && now.ws === ws && now.session === context.session && now.shard === context.shard &&
          now.generation === context.generation && this.scope === scope;
      };
      return await new Promise<FirstCityResponse>((resolve, reject) => {
        let done = false;
        const finish = (response?: FirstCityResponse) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          this.pending.delete(cancel);
          ws.removeEventListener("message", receive);
          ws.removeEventListener("close", cancel);
          ws.removeEventListener("error", cancel);
          signal?.removeEventListener("abort", cancel);
          if (response) resolve(response);
          else reject(firstCityUnknown());
        };
        const cancel = () => finish();
        const receive = (event: MessageEvent) => {
          try {
            if (!current()) return cancel();
            const envelope = readFirstCityPacket(event.data);
            if (envelope.trace !== trace) return;
            if (envelope.code !== 0n) return cancel();
            const response = decodeFirstCityResponse(route, envelope.data);
            if (response.scope.shard !== context.shard) return cancel();
            if (response.kind === "discovery") this.scope = response.scope;
            else if (!scope || !sameScope(response.scope, scope) || response.requestedCommandId !== commandId ||
              (response.kind === "command" && original && !original.matches(response.command!.intent.encode()))) return cancel();
            finish(response);
          } catch { cancel(); }
        };
        const timer = setTimeout(cancel, timeout);
        this.pending.add(cancel);
        ws.addEventListener("message", receive);
        ws.addEventListener("close", cancel);
        ws.addEventListener("error", cancel);
        signal?.addEventListener("abort", cancel, { once: true });
        try { ws.send(packet); } catch { cancel(); }
      });
    } catch { throw firstCityUnknown(); }
  }
}

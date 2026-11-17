import { validateFirstCityScope } from "./firstCityCanonical";
import type { FirstCityScope } from "./firstCityCanonical";
import type { FirstCityCallOptions, FirstCityRoute } from "./firstCityGateway";
import { createFirstCityKnowledge, reduceFirstCityKnowledge, type FirstCityKnowledge } from "./firstCityKnowledge";
import type { FirstCityResponse } from "./firstCityResponseCodec";
import type { FirstCityHistory } from "./firstCityJournal";
import { firstCityUnknown } from "./firstCityPacket";

export type FirstCityGatewayPort = Readonly<{
  requestPersistedFirstCity(route: FirstCityRoute, request: unknown, options?: FirstCityCallOptions): Promise<FirstCityResponse>;
  readFirstCityHistory(scope: FirstCityScope): FirstCityHistory;
}>;

const scopeStamp = (scope: FirstCityScope) => JSON.stringify(scope, (_, v) => typeof v === "bigint" ? String(v) : v);

/** Dormant evidence sync; no submit policy, navigation, or server activation. */
export class FirstCityController {
  private knowledge: FirstCityKnowledge | null = null;
  constructor(private readonly gateway: FirstCityGatewayPort) {}

  snapshot(): FirstCityKnowledge | null { return this.knowledge; }

  private sync(scope: FirstCityScope): FirstCityKnowledge {
    const next = validateFirstCityScope(scope);
    const history = this.gateway.readFirstCityHistory(next);
    const previous = this.knowledge && scopeStamp(this.knowledge.scope) === scopeStamp(next)
      ? this.knowledge : createFirstCityKnowledge(next);
    this.knowledge = reduceFirstCityKnowledge(previous, history);
    return this.knowledge;
  }

  async discover(options?: FirstCityCallOptions): Promise<FirstCityKnowledge> {
    const response = await this.gateway.requestPersistedFirstCity("world.v2.DiscoverFirstCityIntent", {}, options);
    if (response.kind !== "discovery") throw firstCityUnknown();
    return this.sync(response.scope);
  }

  refresh(scope: FirstCityScope): FirstCityKnowledge { return this.sync(scope); }

  async submit(request: unknown, options?: FirstCityCallOptions): Promise<FirstCityKnowledge> {
    const response = await this.gateway.requestPersistedFirstCity("world.v2.SubmitFirstCity", request, options);
    return this.sync(response.scope);
  }

  async continueCommand(request: unknown, options?: FirstCityCallOptions): Promise<FirstCityKnowledge> {
    const response = await this.gateway.requestPersistedFirstCity("world.v2.ContinueFirstCity", request, options);
    return this.sync(response.scope);
  }

  async getResult(request: unknown, options?: FirstCityCallOptions): Promise<FirstCityKnowledge> {
    const response = await this.gateway.requestPersistedFirstCity("world.v2.GetFirstCityResult", request, options);
    return this.sync(response.scope);
  }
}

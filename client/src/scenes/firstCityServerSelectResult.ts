import { validateFirstCityUuid } from "@/net/firstCityCanonical";
import type { FirstCityController } from "@/net/firstCityController";
import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";
import type { FirstCityResponse } from "@/net/firstCityResponseCodec";
import { ensureFirstCitySession as ensureSession, type FirstCityProbeGateway } from "./firstCityServerSelectEntry";

export function canOfferFirstCityResult(knowledge: FirstCityKnowledge | null): boolean {
  return !!knowledge && !knowledge.unavailable;
}

export function suggestResultCommandId(knowledge: FirstCityKnowledge): string {
  const head = knowledge.head;
  if (head?.kind === "command") return head.record.intent.proposal.commandId;
  return knowledge.intents.at(-1)?.proposal.commandId ?? "";
}

export function formatFirstCityResultStatus(knowledge: FirstCityKnowledge): string {
  const observation = latestGetObservation(knowledge);
  if (observation?.kind === "notObserved") {
    return "GetFirstCityResult：NOT_OBSERVED；不表示其他 scope 或 actor 的权威结论。";
  }
  if (observation?.kind === "command" && observation.command) {
    const state = observation.command.state.kind;
    if (state === "succeeded") return "GetFirstCityResult 读到 succeeded 终态；进入主城须另卡，本页不跳转。";
    if (state === "pending") return "GetFirstCityResult 读到 pending；不代表服务端已最终承认。";
    return "GetFirstCityResult 读到 rejected_no_effect；未调用 v1 建城。";
  }
  if (knowledge.unavailable) return "首城本地证据不可用；未调用 v1 建城。";
  return "GetFirstCityResult 往返完成；未进入主城，亦不宣称可玩首城完成。";
}

function latestGetObservation(knowledge: FirstCityKnowledge): FirstCityResponse | undefined {
  for (let index = knowledge.observations.length - 1; index >= 0; index--) {
    const value = knowledge.observations[index]!;
    if (value.kind !== "discovery") return value;
  }
  return undefined;
}

export async function runFirstCityGetResultCommand(
  gateway: FirstCityProbeGateway,
  controller: FirstCityController,
  knowledge: FirstCityKnowledge,
  commandIdInput: string,
  loginName: string,
  password: string,
  serverId: number,
  generation?: number,
): Promise<{ message: string; knowledge: FirstCityKnowledge }> {
  if (!canOfferFirstCityResult(knowledge)) throw new TypeError("Invalid first-city result");
  const commandId = validateFirstCityUuid(commandIdInput.trim());
  const request = { expectedScope: knowledge.scope, commandId };
  await ensureSession(gateway, loginName, password, serverId, generation);
  const next = await controller.getResult(request);
  return { message: formatFirstCityResultStatus(next), knowledge: next };
}

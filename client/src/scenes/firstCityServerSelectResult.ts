import { validateFirstCityUuid } from "@/net/firstCityCanonical";
import type { FirstCityController } from "@/net/firstCityController";
import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";
import type { FirstCityResponse } from "@/net/firstCityResponseCodec";
import { ensureFirstCitySession, type FirstCityProbeGateway } from "./firstCityServerSelectEntry";

export function suggestFirstCityResultCommandId(knowledge: FirstCityKnowledge | null): string {
  if (!knowledge) return "";
  if (knowledge.head?.kind === "command") return knowledge.head.record.intent.proposal.commandId;
  const lastIntent = knowledge.intents[knowledge.intents.length - 1];
  if (lastIntent) return lastIntent.proposal.commandId;
  const lastRecord = knowledge.records[knowledge.records.length - 1];
  return lastRecord ? lastRecord.intent.proposal.commandId : "";
}

export function canOfferFirstCityResult(knowledge: FirstCityKnowledge | null, commandId: string): boolean {
  if (!knowledge || knowledge.unavailable) return false;
  const trimmed = commandId.trim();
  if (!trimmed) return false;
  try {
    validateFirstCityUuid(trimmed);
    return true;
  } catch {
    return false;
  }
}

export function buildGetResultRequest(knowledge: FirstCityKnowledge, commandId: string): unknown {
  const id = validateFirstCityUuid(commandId.trim());
  return { expectedScope: knowledge.scope, commandId: id };
}

export function latestFirstCityResultObservation(
  knowledge: FirstCityKnowledge,
  commandId: string,
): FirstCityResponse | null {
  const id = commandId.trim();
  for (let index = knowledge.observations.length - 1; index >= 0; index--) {
    const value = knowledge.observations[index];
    if (value.kind === "discovery") continue;
    if (value.requestedCommandId === id) return value;
  }
  return null;
}

export function formatFirstCityResultStatus(knowledge: FirstCityKnowledge, commandId: string): string {
  if (knowledge.unavailable) return "首城本地证据不可用；未调用 v1 建城。";
  const observation = latestFirstCityResultObservation(knowledge, commandId);
  if (observation?.kind === "notObserved") {
    return "GetFirstCityResult 返回 NOT_OBSERVED；未保留该 commandId 的记录。不宣称可玩首城或已进入主城。";
  }
  if (observation?.kind === "headConflict") {
    return "GetFirstCityResult 返回 headConflict；保留本地证据，勿重复自动提交。";
  }
  if (observation?.kind === "idContentConflict") {
    return "GetFirstCityResult 返回 idContentConflict；内容冲突已隔离，未进入主城。";
  }
  const record =
    observation?.kind === "command" && observation.command ? observation.command
      : knowledge.records.find(value => value.intent.proposal.commandId === commandId.trim());
  if (record) {
    if (record.state.kind === "pending") {
      return "查询到 pending；不代表服务端已承认完成，不自动发送 Continue。";
    }
    if (record.state.kind === "succeeded") {
      return "查询到 succeeded 终态，但进入主城仍须单独验收；不宣称可玩首城验收已完成。";
    }
    if (record.state.kind === "rejected") {
      return "查询到 rejected 终态；未进入主城，亦不宣称生产首城成功。";
    }
  }
  return "GetFirstCityResult 往返已完成；未进入主城，亦不宣称生产首城成功。";
}

export async function runFirstCityResultCommand(
  gateway: FirstCityProbeGateway,
  controller: FirstCityController,
  knowledge: FirstCityKnowledge,
  commandId: string,
  loginName: string,
  password: string,
  serverId: number,
  generation?: number,
): Promise<{ message: string; knowledge: FirstCityKnowledge }> {
  if (!canOfferFirstCityResult(knowledge, commandId)) throw new TypeError("Invalid first-city get result");
  const request = buildGetResultRequest(knowledge, commandId);
  await ensureFirstCitySession(gateway, loginName, password, serverId, generation);
  const next = await controller.getResult(request);
  const id = validateFirstCityUuid(commandId.trim());
  return { message: formatFirstCityResultStatus(next, id), knowledge: next };
}

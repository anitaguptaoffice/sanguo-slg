import { createFirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityController } from "@/net/firstCityController";
import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";
import {
  assertFirstCityActorFresh,
  type FirstCityActorBinding,
  type FirstCityIdentityGateway,
} from "./firstCityServerSelectActor";
import { ensureFirstCitySession as ensureSession, type FirstCityProbeGateway } from "./firstCityServerSelectEntry";

export type FirstCityProposalInput = Readonly<{ name: string; x: number; y: number }>;

export function canOfferFirstCitySubmit(knowledge: FirstCityKnowledge | null): boolean {
  return !!knowledge && !knowledge.unavailable && knowledge.head?.kind === "empty";
}

export function canOfferFirstCityContinue(knowledge: FirstCityKnowledge | null): boolean {
  if (!knowledge || knowledge.unavailable) return false;
  const head = knowledge.head;
  return head?.kind === "command" && head.record.state.kind === "pending";
}

export function formatFirstCityCommandStatus(knowledge: FirstCityKnowledge): string {
  const terminal = knowledge.records.find(record => record.state.kind === "succeeded");
  if (terminal) return "命令已读到 succeeded 终态，但进入主城仍须单独验收；本次不自动跳转。";
  const pending = knowledge.records.find(record => record.state.kind === "pending");
  if (pending) return "命令处于 pending；Continue 仅在显式点击时发送，不代表服务端已承认。";
  if (knowledge.unavailable) return "首城本地证据不可用；未调用 v1 建城。";
  return "V2 命令往返已完成；未进入主城，亦不宣称生产首城成功。";
}

export function buildSubmitRequest(knowledge: FirstCityKnowledge, input: FirstCityProposalInput): unknown {
  const intent = createFirstCityIntent(knowledge.scope, {
    commandId: crypto.randomUUID(),
    predecessor: { kind: "empty" },
    name: input.name,
    x: input.x,
    y: input.y,
  });
  return { expectedScope: intent.scope, proposal: intent.proposal };
}

export function buildContinueRequest(knowledge: FirstCityKnowledge): unknown | null {
  if (!canOfferFirstCityContinue(knowledge)) return null;
  const head = knowledge.head;
  if (head?.kind !== "command") return null;
  return { expectedScope: head.record.intent.scope, proposal: head.record.intent.proposal };
}

async function runCommand(
  gateway: FirstCityProbeGateway,
  controller: FirstCityController,
  knowledge: FirstCityKnowledge,
  loginName: string,
  password: string,
  serverId: number,
  generation: number | undefined,
  actorBinding: FirstCityActorBinding | null,
  action: (controller: FirstCityController, request: unknown) => Promise<FirstCityKnowledge>,
  request: unknown,
): Promise<{ message: string; knowledge: FirstCityKnowledge }> {
  await ensureSession(gateway, loginName, password, serverId, generation);
  assertFirstCityActorFresh(gateway as FirstCityIdentityGateway, actorBinding, knowledge, loginName, serverId,
    generation ?? (gateway as FirstCityIdentityGateway).getSessionGeneration?.());
  const next = await action(controller, request);
  return { message: formatFirstCityCommandStatus(next), knowledge: next };
}

export async function runFirstCitySubmitCommand(
  gateway: FirstCityProbeGateway,
  controller: FirstCityController,
  knowledge: FirstCityKnowledge,
  input: FirstCityProposalInput,
  loginName: string,
  password: string,
  serverId: number,
  generation?: number,
  actorBinding: FirstCityActorBinding | null = null,
): Promise<{ message: string; knowledge: FirstCityKnowledge }> {
  if (!canOfferFirstCitySubmit(knowledge)) throw new TypeError("Invalid first-city submit");
  const request = buildSubmitRequest(knowledge, input);
  return runCommand(gateway, controller, knowledge, loginName, password, serverId, generation, actorBinding,
    (c, value) => c.submit(value), request);
}

export async function runFirstCityContinueCommand(
  gateway: FirstCityProbeGateway,
  controller: FirstCityController,
  knowledge: FirstCityKnowledge,
  loginName: string,
  password: string,
  serverId: number,
  generation?: number,
  actorBinding: FirstCityActorBinding | null = null,
): Promise<{ message: string; knowledge: FirstCityKnowledge }> {
  const request = buildContinueRequest(knowledge);
  if (!request) throw new TypeError("Invalid first-city continue");
  return runCommand(gateway, controller, knowledge, loginName, password, serverId, generation, actorBinding,
    (c, value) => c.continueCommand(value), request);
}

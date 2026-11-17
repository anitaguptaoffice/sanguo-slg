import { createFirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityController } from "@/net/firstCityController";
import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";
import {
  ensureFirstCitySession as ensureSession,
  runFirstCityDiscoverProbe,
  type FirstCityProbeGateway,
} from "./firstCityServerSelectEntry";

export type FirstCityProposalInput = Readonly<{ name: string; x: number; y: number }>;

export function canOfferFirstCitySubmit(knowledge: FirstCityKnowledge | null): boolean {
  if (!knowledge || knowledge.unavailable || knowledge.incomplete) return false;
  // A stale rejected head cannot authorize another command after an uncertain send.
  if (knowledge.intents.some(intent => !knowledge.records.some(record => {
    if (record.intent.proposal.commandId === intent.proposal.commandId) return record.state.kind !== "pending";
    // A durable sibling won the immutable predecessor CAS: this local proposal
    // cannot have been accepted, even though HEAD_CONFLICT stores no record for it.
    const a = intent.proposal.predecessor, b = record.intent.proposal.predecessor;
    return a.kind === "empty" ? b.kind === "empty" : b.kind === "rejected" && a.commandId === b.commandId;
  }))) return false;
  const head = knowledge.head;
  return head?.kind === "empty" || (head?.kind === "command" && head.record.state.kind === "rejected");
}

export function canOfferFirstCityContinue(knowledge: FirstCityKnowledge | null): boolean {
  if (!knowledge || knowledge.unavailable) return false;
  const head = knowledge.head;
  return head?.kind === "command" && head.record.state.kind === "pending";
}

export function formatFirstCityRejection(reason: "terrain" | "coordinateOccupied", canRetry: boolean): string {
  const cause = reason === "terrain" ? "此处地形不能建城" : "此坐标已被占用";
  return `建城未成功：${cause}。` + (canRetry
    ? "请更换坐标，再点击提交创建新城；原命令不会重试。"
    : "请先查询当前建城状态，勿重复提交。");
}

export function formatFirstCityCommandStatus(knowledge: FirstCityKnowledge): string {
  if (knowledge.unavailable || knowledge.incomplete) return "建城结果尚未确认，请先查询当前状态，勿重复提交。";
  const head = knowledge.head;
  if (head?.kind === "command") {
    const state = head.record.state;
    if (state.kind === "succeeded") return "首城已创建，正在进入主城。";
    if (state.kind === "pending") return "建城仍在处理中；请点击继续查询处理结果，勿重复提交。";
    return formatFirstCityRejection(state.reason, canOfferFirstCitySubmit(knowledge));
  }
  return "建城结果尚未确认，未进入主城；请先查询当前状态。";
}

export function buildSubmitRequest(knowledge: FirstCityKnowledge, input: FirstCityProposalInput): unknown {
  if (!canOfferFirstCitySubmit(knowledge)) throw new TypeError("Invalid first-city submit");
  const predecessor = knowledge.head?.kind === "command"
    ? { kind: "rejected" as const, commandId: knowledge.head.record.intent.proposal.commandId }
    : { kind: "empty" as const };
  const intent = createFirstCityIntent(knowledge.scope, {
    commandId: crypto.randomUUID(),
    predecessor,
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
  loginName: string,
  password: string,
  serverId: number,
  generation: number | undefined,
  action: (controller: FirstCityController, request: unknown) => Promise<FirstCityKnowledge>,
  request: unknown,
): Promise<{ message: string; knowledge: FirstCityKnowledge }> {
  await ensureSession(gateway, loginName, password, serverId, generation);
  const knowledge = await action(controller, request);
  return { message: formatFirstCityCommandStatus(knowledge), knowledge };
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
): Promise<{ message: string; knowledge: FirstCityKnowledge }> {
  if (!canOfferFirstCitySubmit(knowledge)) throw new TypeError("Invalid first-city submit");
  const request = buildSubmitRequest(knowledge, input);
  return runCommand(gateway, controller, loginName, password, serverId, generation,
    (c, value) => c.submit(value), request);
}

/** Submit then, when durable head is still pending, one explicit Continue (effect / ACK-loss recovery). */
/** After Submit transport UNKNOWN, rediscover durable head then Continue when pending (WS ACK-loss recovery). */
export async function runFirstCityRecoverAfterSubmitTransportFailure(
  gateway: FirstCityProbeGateway,
  loginName: string,
  password: string,
  serverId: number,
  generation?: number,
): Promise<{ message: string; knowledge: FirstCityKnowledge; controller: FirstCityController }> {
  const probe = await runFirstCityDiscoverProbe(gateway, loginName, password, serverId, generation);
  if (canOfferFirstCityContinue(probe.knowledge)) {
    const continued = await runFirstCityContinueCommand(
      gateway, probe.controller, probe.knowledge, loginName, password, serverId, generation,
    );
    return { message: continued.message, knowledge: continued.knowledge, controller: probe.controller };
  }
  return { message: probe.message, knowledge: probe.knowledge, controller: probe.controller };
}

export async function runFirstCitySubmitThroughTerminal(
  gateway: FirstCityProbeGateway,
  controller: FirstCityController,
  knowledge: FirstCityKnowledge,
  input: FirstCityProposalInput,
  loginName: string,
  password: string,
  serverId: number,
  generation?: number,
): Promise<{ message: string; knowledge: FirstCityKnowledge }> {
  const afterSubmit = await runFirstCitySubmitCommand(
    gateway, controller, knowledge, input, loginName, password, serverId, generation,
  );
  if (!canOfferFirstCityContinue(afterSubmit.knowledge)) return afterSubmit;
  return runFirstCityContinueCommand(
    gateway, controller, afterSubmit.knowledge, loginName, password, serverId, generation,
  );
}

export async function runFirstCityContinueCommand(
  gateway: FirstCityProbeGateway,
  controller: FirstCityController,
  knowledge: FirstCityKnowledge,
  loginName: string,
  password: string,
  serverId: number,
  generation?: number,
): Promise<{ message: string; knowledge: FirstCityKnowledge }> {
  const request = buildContinueRequest(knowledge);
  if (!request) throw new TypeError("Invalid first-city continue");
  return runCommand(gateway, controller, loginName, password, serverId, generation,
    (c, value) => c.continueCommand(value), request);
}

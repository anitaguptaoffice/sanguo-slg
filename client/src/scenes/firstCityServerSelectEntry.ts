import type { FirstCityGatewayPort } from "@/net/firstCityController";
import { FirstCityController } from "@/net/firstCityController";
import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";
import { firstCityUnknown } from "@/net/firstCityPacket";

export type FirstCityProbeGateway = FirstCityGatewayPort & Readonly<{
  login(loginName: string, password: string, serverId: number): Promise<unknown>;
  enterGameServer(serverId: number): Promise<unknown>;
  getSessionGeneration?(): number;
}>;

/** Local loopback ws only; rejects every wss and remote ws. Not a product default-on flag. */
export function permitsFirstCityV2Probe(url: string): boolean {
  try {
    const target = new URL(url);
    return target.protocol === "ws:" && !target.username && !target.password &&
      ["127.0.0.1", "localhost", "[::1]"].includes(target.hostname);
  } catch { return false; }
}

export function supportsFirstCityPersisted(gateway: unknown): gateway is FirstCityProbeGateway {
  return !!gateway && typeof (gateway as FirstCityProbeGateway).requestPersistedFirstCity === "function" &&
    typeof (gateway as FirstCityProbeGateway).readFirstCityHistory === "function";
}

export function formatFirstCityProbeStatus(knowledge: FirstCityKnowledge): string {
  if (knowledge.unavailable) return "首城本地证据不可用；未调用 v1 建城，也未进入主城。";
  const terminal = knowledge.records.find(record => record.state.kind === "succeeded");
  if (terminal) {
    return "探测读到终态记录，但进入主城仍须单独验收；本次不自动跳转。";
  }
  if (knowledge.head?.kind === "empty") {
    return "V2 发现已完成（durable head 为空）。这不代表可提交建城、服务端已激活或已进入游戏。";
  }
  if (knowledge.incomplete) return "首城证据不完整；请保留本地记录，勿重复自动提交。";
  if (knowledge.head?.kind === "command" && knowledge.records[0]?.state.kind === "pending") {
    return "探测到未完成首城命令；Continue/Submit 须在其他显式步骤中操作。";
  }
  return "V2 发现往返已完成；当前无自动建城或进服。";
}

export async function ensureFirstCitySession(
  gateway: FirstCityProbeGateway,
  loginName: string,
  password: string,
  serverId: number,
  generation?: number,
): Promise<void> {
  if (!loginName || !password || !Number.isInteger(serverId) || serverId < 1) throw firstCityUnknown();
  const stamp = generation ?? gateway.getSessionGeneration?.();
  await gateway.login(loginName, password, serverId);
  if (stamp !== undefined && gateway.getSessionGeneration?.() !== stamp) throw firstCityUnknown();
  await gateway.enterGameServer(serverId);
  if (stamp !== undefined && gateway.getSessionGeneration?.() !== stamp) throw firstCityUnknown();
}

/** Explicit discover only; never provisions v1 cities or navigates to main city. */
export async function runFirstCityDiscoverProbe(
  gateway: FirstCityProbeGateway,
  loginName: string,
  password: string,
  serverId: number,
  generation?: number,
): Promise<{ message: string; knowledge: FirstCityKnowledge; controller: FirstCityController }> {
  await ensureFirstCitySession(gateway, loginName, password, serverId, generation);
  const controller = new FirstCityController(gateway);
  const knowledge = await controller.discover();
  return { message: formatFirstCityProbeStatus(knowledge), knowledge, controller };
}

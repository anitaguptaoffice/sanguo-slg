import type { ResourceWallet } from "@/net/bootstrapSession";
import { WALLET_RESOURCE_KEYS, walletResourceIncreases } from "@/net/hudFormat";

export const RESOURCE_PULSE_CLASS = "resource-pulse";
/** HUD 资源增量脉冲时长（≤2s，与 index.html 动画一致）。 */
export const RESOURCE_PULSE_MS = 1800;

/** 比较前后钱包，返回应触发顶栏脉冲的资源键（仅增量 > 0）。 */
export function walletResourcePulseKeys(
  before: ResourceWallet | undefined,
  after: ResourceWallet | undefined,
): (keyof ResourceWallet)[] {
  const inc = walletResourceIncreases(before, after);
  return WALLET_RESOURCE_KEYS.filter(({ key }) => (inc[key] ?? 0) > 0).map(({ key }) => key);
}

/** 在 `#hud` 资源条对应项上触发短暂 CSS 脉冲，不阻塞交互。 */
export function scheduleHudResourcePulse(
  hud: HTMLElement,
  keys: readonly (keyof ResourceWallet)[],
): void {
  if (!keys.length) return;
  const strip = hud.querySelector('[data-role="hud-resources"]');
  if (!strip) return;
  for (const key of keys) {
    const item = strip.querySelector(`[data-resource="${key}"]`);
    if (!(item instanceof HTMLElement)) continue;
    item.classList.remove(RESOURCE_PULSE_CLASS);
    void item.offsetWidth;
    item.classList.add(RESOURCE_PULSE_CLASS);
    window.setTimeout(() => item.classList.remove(RESOURCE_PULSE_CLASS), RESOURCE_PULSE_MS);
  }
}

import { describe, expect, it } from "vitest";
import {
  canPersuadeTarget,
  canRunPersuadePrimary,
  formatPersuadeGatewayError,
  LIONIZE_STATE_BEFRIENDED,
  LIONIZE_STATE_NONE,
  parsePersuadeTargetListResponse,
  persuadeOnCooldown,
  resolvePersuadePrimaryAction,
} from "@/net/persuadeState";

describe("persuadeState (CLIENT-hero-persuade-001)", () => {
  it("maps gateway cooldown and capacity errors", () => {
    const cd = Object.assign(new Error("hero: persuade on cooldown"), { code: 10001 });
    expect(formatPersuadeGatewayError(cd)).toContain("游说冷却");
    const cap = new Error("hero: hero capacity full (office level)");
    expect(formatPersuadeGatewayError(cap)).toContain("招贤馆容量已满");
  });

  it("parses target list and resolves primary action", () => {
    const targets = parsePersuadeTargetListResponse({
      targets: [
        {
          npc_cfg_id: 1001,
          display_name: "刘备",
          level: 40,
          friend: 0,
          state: LIONIZE_STATE_NONE,
          hire_friend_min: 30,
        },
        {
          npc_cfg_id: 1002,
          display_name: "关羽",
          friend: 20,
          state: LIONIZE_STATE_BEFRIENDED,
          hire_friend_min: 30,
        },
      ],
    });
    expect(targets).toHaveLength(2);
    expect(resolvePersuadePrimaryAction(targets[0])).toBe("befriend");
    expect(resolvePersuadePrimaryAction(targets[1])).toBe("persuade");
    const ready = { ...targets[1], friend: 30 };
    expect(resolvePersuadePrimaryAction(ready)).toBe("hire");
  });

  it("blocks persuade on cooldown and low friend hire", () => {
    const cooling = {
      npc_cfg_id: 1002,
      display_name: "关羽",
      friend: 10,
      state: LIONIZE_STATE_BEFRIENDED,
      hire_friend_min: 30,
      next_persuade_at_ms: Date.now() + 60_000,
    };
    expect(persuadeOnCooldown(cooling)).toBe(true);
    expect(canPersuadeTarget(cooling, [{ item_cfg_id: 2004, quantity: 1 }]).ok).toBe(false);
    const lowFriend = {
      npc_cfg_id: 1003,
      display_name: "张飞",
      friend: 20,
      state: LIONIZE_STATE_BEFRIENDED,
      hire_friend_min: 30,
    };
    expect(resolvePersuadePrimaryAction(lowFriend)).toBe("persuade");
    const hireGate = canRunPersuadePrimary(lowFriend, { gold: 99999 }, [{ item_cfg_id: 2004, quantity: 1 }]);
    expect(hireGate.ok).toBe(true);
  });
});

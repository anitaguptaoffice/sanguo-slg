import { describe, expect, it } from "vitest";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { ContentPanels } from "@/ui/ContentPanels";

function baseSession(): MainCitySession {
  return {
    serverId: 1,
    cityId: 1,
    cityName: "城",
    player: { player_id: 10001, display_name: "演示君主", power: 5000 },
    wallet: { food: 100, wood: 200, iron: 0, stone: 0, gold: 50 },
    buildings: [],
    cityTroops: [],
    bag: [],
  };
}

function minimalGateway(): GatewayPort {
  return {
    getBoundServerId: () => 1,
  } as unknown as GatewayPort;
}

describe("ContentPanels narrow scroll (CLIENT-095)", () => {
  it("bag and shop panels have center-panel id and panel-scroll-body", () => {
    const mount = document.createElement("div");
    const panels = new ContentPanels(
      mount,
      minimalGateway(),
      () => baseSession(),
      () => {},
      () => {},
    );
    panels.attach();
    expect(mount.querySelector('[data-center-panel="bag"]')).toBeTruthy();
    expect(mount.querySelector('[data-center-panel="bag"] .panel-scroll-body')).toBeTruthy();
    expect(mount.querySelector('[data-center-panel="shop"]')).toBeTruthy();
    expect(mount.querySelector('[data-center-panel="shop"] .panel-scroll-body')).toBeTruthy();
    expect(mount.querySelector('[data-role="bag-wallet-gap"]')).toBeTruthy();
    expect(mount.querySelector('[data-role="shop-wallet-gap"]')).toBeTruthy();
  });

  it("resets bag scroll body when toggling open", () => {
    const mount = document.createElement("div");
    const panels = new ContentPanels(
      mount,
      minimalGateway(),
      () => baseSession(),
      () => {},
      () => {},
    );
    panels.attach();
    const body = mount.querySelector('[data-center-panel="bag"] .panel-scroll-body') as HTMLElement;
    body.scrollTop = 120;
    panels.toggleBag();
    panels.toggleBag();
    expect(body.scrollTop).toBe(0);
  });
});

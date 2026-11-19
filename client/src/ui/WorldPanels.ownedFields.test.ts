import { describe, expect, it, vi } from "vitest";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { WorldPanels } from "./WorldPanels";
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
function setup() {
  const mount = document.createElement("div"), form = document.createElement("div"), status = vi.fn();
  form.innerHTML = '<input data-field="to-x"><input data-field="to-y">';
  const session = { serverId: 1, cityId: 1, cityName: "城", wallet: {}, buildings: [], cityTroops: [], bag: [] } as MainCitySession;
  const gateway = {
    getBoundServerId: () => 1,
    getSessionGeneration: () => 1,
    listPlayerCities: vi.fn().mockResolvedValue({ cities: [] }),
    listOwnedFields: vi.fn().mockResolvedValue({
      fields: [{ x: 30, y: 40, name: "森林 Lv3", bonus_percent: 10 }],
    }),
    abandonField: vi.fn().mockResolvedValue({ abandoned: true }),
  };
  const panels = new WorldPanels(mount, gateway as unknown as GatewayPort, () => session, { marchFormRoot: form }, status);
  panels.attach();
  const summary = () => mount.querySelector('[data-role="owned-fields-summary"]')!.textContent;
  const rows = () => [...mount.querySelectorAll<HTMLLIElement>(".world-owned-field-row")].map((row) => row.textContent);
  return { panels, mount, gateway, status, summary, rows };
}
describe("owned wild fields", () => {
  it("lists the city's owned fields after the panel opens", async () => {
    const { panels, gateway, summary, rows } = setup();
    panels.toggle(); await flush();
    expect(gateway.listOwnedFields).toHaveBeenCalledWith(1);
    expect(summary()).toContain("附属野地 1 块");
    expect(rows()[0]).toContain("森林 Lv3 (30,40)");
    expect(rows()[0]).toContain("产量 +10%");
    panels.detach();
  });

  it("abandons a field through the gateway and refreshes the list", async () => {
    const { panels, mount, gateway, summary } = setup();
    panels.toggle(); await flush();
    gateway.listOwnedFields.mockResolvedValueOnce({ fields: [] });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mount.querySelector<HTMLButtonElement>('[data-action="abandon-field"]')!.click();
    await flush(); await flush();
    expect(gateway.abandonField).toHaveBeenCalledWith(1, 30, 40);
    expect(summary()).toContain("尚未占领野地");
    expect(mount.querySelectorAll(".world-owned-field-row").length).toBe(0);
    panels.detach();
  });

  it("keeps the list empty when a field read fails", async () => {
    const { panels, gateway, summary, status } = setup();
    gateway.listOwnedFields.mockRejectedValueOnce(new Error("boom"));
    panels.toggle(); await flush();
    expect(summary()).toContain("野地列表加载失败");
    expect(status).not.toHaveBeenCalledWith(expect.stringContaining("boom"));
    panels.detach();
  });
});

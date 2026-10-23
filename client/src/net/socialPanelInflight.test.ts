import { describe, expect, it } from "vitest";
import { SocialPanelInflight } from "@/net/socialPanelInflight";

describe("SocialPanelInflight", () => {
  it("dedupes concurrent runs until the first settles", async () => {
    const gate = new SocialPanelInflight<number>();
    let calls = 0;
    const slow = () =>
      new Promise<number>((resolve) => {
        calls += 1;
        setTimeout(() => resolve(calls), 5);
      });

    const a = gate.run(slow);
    const b = gate.run(slow);
    expect(gate.isBusy()).toBe(true);
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra).toBe(1);
    expect(rb).toBe(1);
    expect(calls).toBe(1);
    expect(gate.isBusy()).toBe(false);
  });
});

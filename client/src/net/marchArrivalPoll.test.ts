import { describe, expect, it, vi } from "vitest";
import { MarchArrivalPoll } from "@/net/marchArrivalPoll";
import { MARCH_PHASE_ARRIVED, MARCH_PHASE_MARCHING } from "@/net/marchArrival";

describe("MarchArrivalPoll", () => {
  it("polls and fires onCompletions when phase changes", async () => {
    const listMarches = vi
      .fn()
      .mockResolvedValueOnce([{ march_id: 1, phase: MARCH_PHASE_MARCHING }])
      .mockResolvedValueOnce([{ march_id: 1, phase: MARCH_PHASE_ARRIVED }]);
    const onCompletions = vi.fn();
    const poll = new MarchArrivalPoll({
      listMarches: async () => listMarches(),
      getCityId: () => 10,
      onCompletions,
      pollIntervalMs: 1000,
    });
    poll.trackMarch(1);
    await poll.pollOnce();
    expect(onCompletions).not.toHaveBeenCalled();
    await poll.pollOnce();
    expect(onCompletions).toHaveBeenCalledWith([{ kind: "phase", marchId: 1 }]);
  });
});

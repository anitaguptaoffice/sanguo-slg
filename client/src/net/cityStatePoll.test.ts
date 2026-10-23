import { describe, expect, it, vi } from "vitest";
import { CityStateFetch } from "@/net/cityStateFetch";
import { CITY_STATE_POLL_FAST_SEC, CITY_STATE_POLL_SLOW_SEC, CityStatePoll } from "@/net/cityStatePoll";

describe("CityStatePoll", () => {
  it("uses fast interval when panel visible", async () => {
    const getCityState = vi.fn().mockResolvedValue({ wallet: {} });
    const fetch = new CityStateFetch({ getCityState }, () => 9);
    const onState = vi.fn();
    const poll = new CityStatePoll({
      fetch,
      onState,
      isPanelVisible: () => true,
      fastIntervalSec: 1,
      slowIntervalSec: 10,
    });
    poll.tick(0.5);
    expect(getCityState).not.toHaveBeenCalled();
    poll.tick(0.6);
    await vi.waitFor(() => expect(onState).toHaveBeenCalled());
    expect(getCityState).toHaveBeenCalledTimes(1);
  });

  it("uses slow interval when panel hidden", () => {
    const getCityState = vi.fn().mockResolvedValue({ wallet: {} });
    const fetch = new CityStateFetch({ getCityState }, () => 9);
    const poll = new CityStatePoll({
      fetch,
      onState: vi.fn(),
      isPanelVisible: () => false,
      fastIntervalSec: 1,
      slowIntervalSec: 3,
    });
    poll.tick(2);
    expect(getCityState).not.toHaveBeenCalled();
    poll.tick(1.1);
    expect(getCityState).toHaveBeenCalledTimes(1);
  });

  it("exports default poll intervals", () => {
    expect(CITY_STATE_POLL_FAST_SEC).toBe(5);
    expect(CITY_STATE_POLL_SLOW_SEC).toBe(30);
  });
});

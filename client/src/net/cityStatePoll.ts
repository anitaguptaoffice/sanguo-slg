import type { CityStateFetch, CityStateSnapshot } from "@/net/cityStateFetch";

export const CITY_STATE_POLL_FAST_SEC = 5;
export const CITY_STATE_POLL_SLOW_SEC = 30;

export type CityStatePollOptions = {
  fetch: CityStateFetch;
  onState: (state: CityStateSnapshot) => void;
  /** 任意内容面板/军事面板等处于打开态时为 true，使用较快轮询。 */
  isPanelVisible: () => boolean;
  fastIntervalSec?: number;
  slowIntervalSec?: number;
};

/** 主城 GetCityState 轮询：单飞由 CityStateFetch 保证；面板隐藏时降频。 */
export class CityStatePoll {
  private accumSec = 0;
  private readonly fastSec: number;
  private readonly slowSec: number;

  constructor(private readonly opts: CityStatePollOptions) {
    this.fastSec = opts.fastIntervalSec ?? CITY_STATE_POLL_FAST_SEC;
    this.slowSec = opts.slowIntervalSec ?? CITY_STATE_POLL_SLOW_SEC;
  }

  reset(): void {
    this.accumSec = 0;
  }

  tick(dtSec: number): void {
    const interval = this.opts.isPanelVisible() ? this.fastSec : this.slowSec;
    this.accumSec += dtSec;
    if (this.accumSec < interval) return;
    this.accumSec = 0;
    void this.pollOnce();
  }

  async pollOnce(): Promise<void> {
    const state = await this.opts.fetch.fetch();
    if (state) this.opts.onState(state);
  }
}

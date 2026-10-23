/** 排行/聊天列表 RPC 单飞：in-flight 期间复用同一 Promise，避免嵌套并发。 */
export class SocialPanelInflight<T> {
  private inflight: Promise<T> | null = null;

  isBusy(): boolean {
    return this.inflight !== null;
  }

  run(task: () => Promise<T>): Promise<T> {
    if (this.inflight) return this.inflight;
    const p = task();
    this.inflight = p;
    void p.finally(() => {
      if (this.inflight === p) this.inflight = null;
    });
    return p;
  }
}

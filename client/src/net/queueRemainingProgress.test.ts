import { describe, expect, it } from "vitest";
import {
  formatQueueRemainingProgress,
  inferBuildUpgradeStartedAtMs,
  renderQueueRemainingProgressMarkup,
} from "@/net/queueRemainingProgress";

describe("formatQueueRemainingProgress", () => {
  it("computes progress from started_at and finish_at", () => {
    const now = 1_000_000;
    const started = now - 30_000;
    const finish = now + 30_000;
    const progress = formatQueueRemainingProgress(finish, now, started);
    expect(progress.remainingText).toBe("剩 0:30");
    expect(progress.overviewCountdown).toBe("最近 剩 0:30");
    expect(progress.progressPercent).toBe(50);
    const markup = renderQueueRemainingProgressMarkup(progress, finish, now);
    expect(markup).toContain("queue-row-eta-line");
    expect(markup).toContain("domestic-queue-eta-segment-label");
    expect(markup).toContain("domestic-queue-eta-segment-residual-label");
    expect(markup).toContain("domestic-queue-eta-segment-residual-deep-label");
    expect(markup).toContain("domestic-queue-eta-segment-residual-deep-finish");
    expect(markup).toContain("domestic-queue-eta-segment-residual-deeper-label");
    expect(markup).toContain("domestic-queue-eta-segment-residual-deeper-finish");
    expect(markup).toContain("domestic-queue-eta-segment-residual-deepest-label");
    expect(markup).toContain("domestic-queue-eta-segment-residual-deepest-finish");
    expect(markup).toContain("domestic-queue-eta-segment-residual-deepest-deeper-label");
    expect(markup).toContain("domestic-queue-eta-segment-residual-deepest-deeper-finish");
    expect(markup).toContain("domestic-queue-eta-segment-residual-deepest-deepest-deeper-label");
    expect(markup).toContain("domestic-queue-eta-segment-residual-deepest-deepest-deeper-finish");
    expect(markup).toContain("domestic-queue-eta-segment-residual-deepest-deepest-deepest-label");
    expect(markup).toContain("domestic-queue-eta-segment-residual-deepest-deepest-deepest-finish");
    expect(markup).toContain(
      "domestic-queue-eta-segment-residual-deepest-deepest-deepest-deeper-label",
    );
    expect(markup).toContain(
      "domestic-queue-eta-segment-residual-deepest-deepest-deepest-deeper-finish",
    );
    expect(markup).toContain(
      "domestic-queue-eta-segment-residual-deepest-deepest-deepest-deepest-label",
    );
    expect(markup).toContain(
      "domestic-queue-eta-segment-residual-deepest-deepest-deepest-deepest-finish",
    );
    expect(markup).toContain("&lt;1h");
    expect(markup).toContain("下一档 完成");
    expect(markup).toContain("巩固分段");
    expect(markup).toContain("巩固再加深");
    expect(markup).toContain("巩固再加深一层");
    expect(markup).toContain("巩固再加深二层");
    expect(markup).toContain("巩固再加深三层");
    expect(markup).toContain("巩固再加深四层");
    expect(markup).toContain("巩固再加深五层");
    expect(markup).toContain("完成倒计时");
    expect(markup).toContain("第四行");
    expect(markup).toContain("第五行");
    expect(markup).toContain("第六行");
    expect(markup).toContain("第七行");
    expect(markup).toContain("第八行");
    expect(markup).toContain("第九行");
    expect(markup).toContain("queue-row-progress-bar");
    expect(markup).toContain("queue-row-progress-fill");
    expect(markup).toContain('style="width:50%"');
  });

  it("omits progress bar without started_at", () => {
    const now = 1_000_000;
    const finish = now + 60_000;
    const progress = formatQueueRemainingProgress(finish, now);
    expect(progress.remainingText).toBe("剩 1:00");
    expect(progress.progressPercent).toBeNull();
    const markup = renderQueueRemainingProgressMarkup(progress, finish, now);
    expect(markup).toContain("queue-row-eta-line");
    expect(markup).toContain("queue-row-countdown");
    expect(markup).not.toContain("queue-row-progress-bar");
  });

  it("inferBuildUpgradeStartedAtMs uses cfg duration", () => {
    const finish = 1_000_000;
    const started = inferBuildUpgradeStartedAtMs({
      slot_key: "farm",
      building_cfg_id: 2,
      level: 1,
      upgrade_finish_at_ms: finish,
    });
    expect(started).toBe(finish - 67_000);
  });
});

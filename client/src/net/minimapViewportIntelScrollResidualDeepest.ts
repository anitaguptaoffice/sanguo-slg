import {
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPER_RING_CLASS,
  syncMinimapViewportIntelScrollResidualDeeper,
  type MinimapViewportIntelScrollResidualDeeperTimers,
  type SyncMinimapViewportIntelScrollResidualDeeperOptions,
} from "@/net/minimapViewportIntelScrollResidualDeeper";
import type { SyncMinimapViewportIntelScrollResidualInput } from "@/net/minimapViewportIntelScrollResidual";
import { MINIMAP_INTEL_SYNC_RING_CLASS } from "@/ui/minimapIntelSyncHighlight";
import {
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEP_RING_CLASS,
} from "@/net/minimapViewportIntelScrollResidualDeep";
import type { SyncMinimapViewportToIntelRowResult } from "@/net/minimapViewportIntelSync";

/** CLIENT-300：军情 scroll-sync 残余巩固再加深一层环（叠 CLIENT-284 deeper ring；CLIENT-220 双向环不退化）。 */
export const MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_RING_CLASS =
  "minimap-intel-scroll-sync-residual-deepest-ring";

export const MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_RING_MS = 1500;

export type MinimapViewportIntelScrollResidualDeepestTimers = {
  residualDeepestRingClassTimer: ReturnType<typeof setTimeout> | null;
};

export function createMinimapViewportIntelScrollResidualDeepestTimers(): MinimapViewportIntelScrollResidualDeepestTimers {
  return { residualDeepestRingClassTimer: null };
}

export type SyncMinimapViewportIntelScrollResidualDeepestOptions =
  SyncMinimapViewportIntelScrollResidualDeeperOptions & {
    residualDeepestTimers?: MinimapViewportIntelScrollResidualDeepestTimers;
    residualDeepestDurationMs?: number;
  };

function clearMinimapIntelScrollSyncResidualDeepestRing(
  layoutFrame: HTMLElement | null | undefined,
  intelRoot: ParentNode | null | undefined,
  marchId: number | null,
): void {
  layoutFrame?.classList.remove(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_RING_CLASS);
  if (intelRoot != null && marchId != null && marchId > 0) {
    intelRoot
      .querySelector<HTMLElement>(
        `.march-list li[data-march-id="${Math.trunc(marchId)}"].${MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_RING_CLASS}`,
      )
      ?.classList.remove(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_RING_CLASS);
  }
}

export type BeginMinimapIntelScrollSyncResidualDeepestRingOptions = {
  durationMs?: number;
  timers?: MinimapViewportIntelScrollResidualDeepestTimers;
  marchId?: number | null;
};

/** 在 CLIENT-284 `minimap-intel-scroll-sync-residual-deeper-ring` 之上叠加 residual deepest ring 1.5s。 */
export function beginMinimapIntelScrollSyncResidualDeepestRing(
  layoutFrame: HTMLElement | null | undefined,
  intelRoot: ParentNode | null | undefined,
  options?: BeginMinimapIntelScrollSyncResidualDeepestRingOptions,
): void {
  const duration = options?.durationMs ?? MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_RING_MS;
  const timers = options?.timers;
  const marchId =
    options?.marchId != null && Number.isFinite(options.marchId) && options.marchId > 0
      ? Math.trunc(options.marchId)
      : null;

  if (timers?.residualDeepestRingClassTimer) {
    clearTimeout(timers.residualDeepestRingClassTimer);
    timers.residualDeepestRingClassTimer = null;
  }
  clearMinimapIntelScrollSyncResidualDeepestRing(layoutFrame, intelRoot, marchId);
  if (!layoutFrame && !intelRoot) return;

  if (layoutFrame) {
    layoutFrame.classList.add(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_RING_CLASS);
    void layoutFrame.offsetWidth;
    if (layoutFrame.classList.contains(MINIMAP_INTEL_SYNC_RING_CLASS)) {
      /* CLIENT-220 双向环须并存 */
    }
    if (layoutFrame.classList.contains(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEP_RING_CLASS)) {
      /* CLIENT-268 residual deep ring 须并存 */
    }
    if (layoutFrame.classList.contains(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPER_RING_CLASS)) {
      /* CLIENT-284 residual deeper ring 须并存 */
    }
  }
  if (intelRoot && marchId != null) {
    const row = intelRoot.querySelector<HTMLElement>(
      `.march-list li[data-march-id="${marchId}"]`,
    );
    row?.classList.add(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_RING_CLASS);
    void row?.offsetWidth;
  }

  if (timers && duration > 0) {
    timers.residualDeepestRingClassTimer = setTimeout(() => {
      timers.residualDeepestRingClassTimer = null;
      clearMinimapIntelScrollSyncResidualDeepestRing(layoutFrame, intelRoot, marchId);
    }, duration);
  }
}

/**
 * 军情行变更：CLIENT-284 scroll-sync 残余巩固再加深 + residual deepest ring 1.5s（CLIENT-300）。
 */
export function syncMinimapViewportIntelScrollResidualDeepest(
  input: SyncMinimapViewportIntelScrollResidualInput,
  options?: SyncMinimapViewportIntelScrollResidualDeepestOptions,
): SyncMinimapViewportToIntelRowResult {
  const viewportResult = syncMinimapViewportIntelScrollResidualDeeper(input, options);

  const march = input.march;
  const marchId = march?.march_id;
  if (viewportResult.applied && marchId != null && Number.isFinite(marchId) && marchId > 0) {
    beginMinimapIntelScrollSyncResidualDeepestRing(input.layoutFrame, input.intelRoot, {
      durationMs:
        options?.residualDeepestDurationMs ?? MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_RING_MS,
      timers: options?.residualDeepestTimers,
      marchId: Math.trunc(marchId),
    });
  }

  return viewportResult;
}

/** @internal vitest */
export function resetMinimapViewportIntelScrollResidualDeepestTimersForTests(
  timers: MinimapViewportIntelScrollResidualDeepestTimers,
): void {
  if (timers.residualDeepestRingClassTimer) {
    clearTimeout(timers.residualDeepestRingClassTimer);
    timers.residualDeepestRingClassTimer = null;
  }
}

/** @internal vitest — CLIENT-284 deeper timers 仍由调用方管理 */
export type { MinimapViewportIntelScrollResidualDeeperTimers };

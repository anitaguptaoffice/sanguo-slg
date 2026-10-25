import {
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_RING_CLASS,
  syncMinimapViewportIntelScrollResidualDeepest,
  type MinimapViewportIntelScrollResidualDeepestTimers,
  type SyncMinimapViewportIntelScrollResidualDeepestOptions,
} from "@/net/minimapViewportIntelScrollResidualDeepest";
import type { SyncMinimapViewportIntelScrollResidualInput } from "@/net/minimapViewportIntelScrollResidual";
import { MINIMAP_INTEL_SYNC_RING_CLASS } from "@/ui/minimapIntelSyncHighlight";
import {
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEP_RING_CLASS,
} from "@/net/minimapViewportIntelScrollResidualDeep";
import {
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPER_RING_CLASS,
} from "@/net/minimapViewportIntelScrollResidualDeeper";
import type { SyncMinimapViewportToIntelRowResult } from "@/net/minimapViewportIntelSync";

/** CLIENT-316：军情 scroll-sync 残余巩固再加深二层环（叠 CLIENT-300 deepest ring；CLIENT-220 双向环不退化）。 */
export const MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPER_RING_CLASS =
  "minimap-intel-scroll-sync-residual-deepest-deeper-ring";

export const MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPER_RING_MS = 1500;

export type MinimapViewportIntelScrollResidualDeepestDeeperTimers = {
  residualDeepestDeeperRingClassTimer: ReturnType<typeof setTimeout> | null;
};

export function createMinimapViewportIntelScrollResidualDeepestDeeperTimers(): MinimapViewportIntelScrollResidualDeepestDeeperTimers {
  return { residualDeepestDeeperRingClassTimer: null };
}

export type SyncMinimapViewportIntelScrollResidualDeepestDeeperOptions =
  SyncMinimapViewportIntelScrollResidualDeepestOptions & {
    residualDeepestDeeperTimers?: MinimapViewportIntelScrollResidualDeepestDeeperTimers;
    residualDeepestDeeperDurationMs?: number;
  };

function clearMinimapIntelScrollSyncResidualDeepestDeeperRing(
  layoutFrame: HTMLElement | null | undefined,
  intelRoot: ParentNode | null | undefined,
  marchId: number | null,
): void {
  layoutFrame?.classList.remove(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPER_RING_CLASS);
  if (intelRoot != null && marchId != null && marchId > 0) {
    intelRoot
      .querySelector<HTMLElement>(
        `.march-list li[data-march-id="${Math.trunc(marchId)}"].${MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPER_RING_CLASS}`,
      )
      ?.classList.remove(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPER_RING_CLASS);
  }
}

export type BeginMinimapIntelScrollSyncResidualDeepestDeeperRingOptions = {
  durationMs?: number;
  timers?: MinimapViewportIntelScrollResidualDeepestDeeperTimers;
  marchId?: number | null;
};

/** 在 CLIENT-300 `minimap-intel-scroll-sync-residual-deepest-ring` 之上叠加 residual deepest-deeper ring 1.5s。 */
export function beginMinimapIntelScrollSyncResidualDeepestDeeperRing(
  layoutFrame: HTMLElement | null | undefined,
  intelRoot: ParentNode | null | undefined,
  options?: BeginMinimapIntelScrollSyncResidualDeepestDeeperRingOptions,
): void {
  const duration =
    options?.durationMs ?? MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPER_RING_MS;
  const timers = options?.timers;
  const marchId =
    options?.marchId != null && Number.isFinite(options.marchId) && options.marchId > 0
      ? Math.trunc(options.marchId)
      : null;

  if (timers?.residualDeepestDeeperRingClassTimer) {
    clearTimeout(timers.residualDeepestDeeperRingClassTimer);
    timers.residualDeepestDeeperRingClassTimer = null;
  }
  clearMinimapIntelScrollSyncResidualDeepestDeeperRing(layoutFrame, intelRoot, marchId);
  if (!layoutFrame && !intelRoot) return;

  if (layoutFrame) {
    layoutFrame.classList.add(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPER_RING_CLASS);
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
    if (layoutFrame.classList.contains(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_RING_CLASS)) {
      /* CLIENT-300 residual deepest ring 须并存 */
    }
  }
  if (intelRoot && marchId != null) {
    const row = intelRoot.querySelector<HTMLElement>(
      `.march-list li[data-march-id="${marchId}"]`,
    );
    row?.classList.add(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPER_RING_CLASS);
    void row?.offsetWidth;
  }

  if (timers && duration > 0) {
    timers.residualDeepestDeeperRingClassTimer = setTimeout(() => {
      timers.residualDeepestDeeperRingClassTimer = null;
      clearMinimapIntelScrollSyncResidualDeepestDeeperRing(layoutFrame, intelRoot, marchId);
    }, duration);
  }
}

/**
 * 军情行变更：CLIENT-300 scroll-sync 残余巩固再加深一层 + residual deepest-deeper ring 1.5s（CLIENT-316）。
 */
export function syncMinimapViewportIntelScrollResidualDeepestDeeper(
  input: SyncMinimapViewportIntelScrollResidualInput,
  options?: SyncMinimapViewportIntelScrollResidualDeepestDeeperOptions,
): SyncMinimapViewportToIntelRowResult {
  const viewportResult = syncMinimapViewportIntelScrollResidualDeepest(input, options);

  const march = input.march;
  const marchId = march?.march_id;
  if (viewportResult.applied && marchId != null && Number.isFinite(marchId) && marchId > 0) {
    beginMinimapIntelScrollSyncResidualDeepestDeeperRing(input.layoutFrame, input.intelRoot, {
      durationMs:
        options?.residualDeepestDeeperDurationMs ??
        MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPER_RING_MS,
      timers: options?.residualDeepestDeeperTimers,
      marchId: Math.trunc(marchId),
    });
  }

  return viewportResult;
}

/** @internal vitest */
export function resetMinimapViewportIntelScrollResidualDeepestDeeperTimersForTests(
  timers: MinimapViewportIntelScrollResidualDeepestDeeperTimers,
): void {
  if (timers.residualDeepestDeeperRingClassTimer) {
    clearTimeout(timers.residualDeepestDeeperRingClassTimer);
    timers.residualDeepestDeeperRingClassTimer = null;
  }
}

/** @internal vitest — CLIENT-300 deepest timers 仍由调用方管理 */
export type { MinimapViewportIntelScrollResidualDeepestTimers };

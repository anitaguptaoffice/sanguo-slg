import {
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPER_RING_CLASS,
  syncMinimapViewportIntelScrollResidualDeepestDeeper,
  type MinimapViewportIntelScrollResidualDeepestDeeperTimers,
  type SyncMinimapViewportIntelScrollResidualDeepestDeeperOptions,
} from "@/net/minimapViewportIntelScrollResidualDeepestDeeper";
import type { SyncMinimapViewportIntelScrollResidualInput } from "@/net/minimapViewportIntelScrollResidual";
import { MINIMAP_INTEL_SYNC_RING_CLASS } from "@/ui/minimapIntelSyncHighlight";
import {
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEP_RING_CLASS,
} from "@/net/minimapViewportIntelScrollResidualDeep";
import {
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPER_RING_CLASS,
} from "@/net/minimapViewportIntelScrollResidualDeeper";
import {
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_RING_CLASS,
} from "@/net/minimapViewportIntelScrollResidualDeepest";
import type { SyncMinimapViewportToIntelRowResult } from "@/net/minimapViewportIntelSync";

/** CLIENT-332：军情 scroll-sync 残余巩固再加深三层环（叠 CLIENT-316 deepest-deeper ring；CLIENT-220 双向环不退化）。 */
export const MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS =
  "minimap-intel-scroll-sync-residual-deepest-deepest-deeper-ring";

export const MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_MS = 1500;

export type MinimapViewportIntelScrollResidualDeepestDeepestDeeperTimers = {
  residualDeepestDeepestDeeperRingClassTimer: ReturnType<typeof setTimeout> | null;
};

export function createMinimapViewportIntelScrollResidualDeepestDeepestDeeperTimers(): MinimapViewportIntelScrollResidualDeepestDeepestDeeperTimers {
  return { residualDeepestDeepestDeeperRingClassTimer: null };
}

export type SyncMinimapViewportIntelScrollResidualDeepestDeepestDeeperOptions =
  SyncMinimapViewportIntelScrollResidualDeepestDeeperOptions & {
    residualDeepestDeepestDeeperTimers?: MinimapViewportIntelScrollResidualDeepestDeepestDeeperTimers;
    residualDeepestDeepestDeeperDurationMs?: number;
  };

function clearMinimapIntelScrollSyncResidualDeepestDeepestDeeperRing(
  layoutFrame: HTMLElement | null | undefined,
  intelRoot: ParentNode | null | undefined,
  marchId: number | null,
): void {
  layoutFrame?.classList.remove(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS);
  if (intelRoot != null && marchId != null && marchId > 0) {
    intelRoot
      .querySelector<HTMLElement>(
        `.march-list li[data-march-id="${Math.trunc(marchId)}"].${MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS}`,
      )
      ?.classList.remove(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS);
  }
}

export type BeginMinimapIntelScrollSyncResidualDeepestDeepestDeeperRingOptions = {
  durationMs?: number;
  timers?: MinimapViewportIntelScrollResidualDeepestDeepestDeeperTimers;
  marchId?: number | null;
};

/** 在 CLIENT-316 `minimap-intel-scroll-sync-residual-deepest-deeper-ring` 之上叠加 residual deepest-deepest-deeper ring 1.5s。 */
export function beginMinimapIntelScrollSyncResidualDeepestDeepestDeeperRing(
  layoutFrame: HTMLElement | null | undefined,
  intelRoot: ParentNode | null | undefined,
  options?: BeginMinimapIntelScrollSyncResidualDeepestDeepestDeeperRingOptions,
): void {
  const duration =
    options?.durationMs ?? MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_MS;
  const timers = options?.timers;
  const marchId =
    options?.marchId != null && Number.isFinite(options.marchId) && options.marchId > 0
      ? Math.trunc(options.marchId)
      : null;

  if (timers?.residualDeepestDeepestDeeperRingClassTimer) {
    clearTimeout(timers.residualDeepestDeepestDeeperRingClassTimer);
    timers.residualDeepestDeepestDeeperRingClassTimer = null;
  }
  clearMinimapIntelScrollSyncResidualDeepestDeepestDeeperRing(layoutFrame, intelRoot, marchId);
  if (!layoutFrame && !intelRoot) return;

  if (layoutFrame) {
    layoutFrame.classList.add(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS);
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
    if (
      layoutFrame.classList.contains(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPER_RING_CLASS)
    ) {
      /* CLIENT-316 residual deepest-deeper ring 须并存 */
    }
  }
  if (intelRoot && marchId != null) {
    const row = intelRoot.querySelector<HTMLElement>(
      `.march-list li[data-march-id="${marchId}"]`,
    );
    row?.classList.add(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS);
    void row?.offsetWidth;
  }

  if (timers && duration > 0) {
    timers.residualDeepestDeepestDeeperRingClassTimer = setTimeout(() => {
      timers.residualDeepestDeepestDeeperRingClassTimer = null;
      clearMinimapIntelScrollSyncResidualDeepestDeepestDeeperRing(layoutFrame, intelRoot, marchId);
    }, duration);
  }
}

/**
 * 军情行变更：CLIENT-316 scroll-sync 残余巩固再加深二层 + residual deepest-deepest-deeper ring 1.5s（CLIENT-332）。
 */
export function syncMinimapViewportIntelScrollResidualDeepestDeepestDeeper(
  input: SyncMinimapViewportIntelScrollResidualInput,
  options?: SyncMinimapViewportIntelScrollResidualDeepestDeepestDeeperOptions,
): SyncMinimapViewportToIntelRowResult {
  const viewportResult = syncMinimapViewportIntelScrollResidualDeepestDeeper(input, options);

  const march = input.march;
  const marchId = march?.march_id;
  if (viewportResult.applied && marchId != null && Number.isFinite(marchId) && marchId > 0) {
    beginMinimapIntelScrollSyncResidualDeepestDeepestDeeperRing(input.layoutFrame, input.intelRoot, {
      durationMs:
        options?.residualDeepestDeepestDeeperDurationMs ??
        MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_MS,
      timers: options?.residualDeepestDeepestDeeperTimers,
      marchId: Math.trunc(marchId),
    });
  }

  return viewportResult;
}

/** @internal vitest */
export function resetMinimapViewportIntelScrollResidualDeepestDeepestDeeperTimersForTests(
  timers: MinimapViewportIntelScrollResidualDeepestDeepestDeeperTimers,
): void {
  if (timers.residualDeepestDeepestDeeperRingClassTimer) {
    clearTimeout(timers.residualDeepestDeepestDeeperRingClassTimer);
    timers.residualDeepestDeepestDeeperRingClassTimer = null;
  }
}

/** @internal vitest — CLIENT-316 deepest-deeper timers 仍由调用方管理 */
export type { MinimapViewportIntelScrollResidualDeepestDeeperTimers };

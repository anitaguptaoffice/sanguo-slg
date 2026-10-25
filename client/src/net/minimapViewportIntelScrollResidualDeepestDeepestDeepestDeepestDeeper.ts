import {
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
  syncMinimapViewportIntelScrollResidualDeepestDeepestDeepestDeeper,
  type MinimapViewportIntelScrollResidualDeepestDeepestDeepestDeeperTimers,
  type SyncMinimapViewportIntelScrollResidualDeepestDeepestDeepestDeeperOptions,
} from "@/net/minimapViewportIntelScrollResidualDeepestDeepestDeepestDeeper";
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
import {
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPER_RING_CLASS,
} from "@/net/minimapViewportIntelScrollResidualDeepestDeeper";
import {
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
} from "@/net/minimapViewportIntelScrollResidualDeepestDeepestDeeper";
import {
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS,
} from "@/net/minimapViewportIntelScrollResidualDeepestDeepestDeepest";
import type { SyncMinimapViewportToIntelRowResult } from "@/net/minimapViewportIntelSync";

/** CLIENT-380：军情 scroll-sync 残余巩固再加深五层环（叠 CLIENT-364 deepest-deepest-deepest-deeper ring；CLIENT-220 双向环不退化）。 */
export const MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS =
  "minimap-intel-scroll-sync-residual-deepest-deepest-deepest-deepest-deeper-ring";

export const MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_MS = 1500;

export type MinimapViewportIntelScrollResidualDeepestDeepestDeepestDeepestDeeperTimers = {
  residualDeepestDeepestDeepestDeepestDeeperRingClassTimer: ReturnType<typeof setTimeout> | null;
};

export function createMinimapViewportIntelScrollResidualDeepestDeepestDeepestDeepestDeeperTimers(): MinimapViewportIntelScrollResidualDeepestDeepestDeepestDeepestDeeperTimers {
  return { residualDeepestDeepestDeepestDeepestDeeperRingClassTimer: null };
}

export type SyncMinimapViewportIntelScrollResidualDeepestDeepestDeepestDeepestDeeperOptions =
  SyncMinimapViewportIntelScrollResidualDeepestDeepestDeepestDeeperOptions & {
    residualDeepestDeepestDeepestDeepestDeeperTimers?: MinimapViewportIntelScrollResidualDeepestDeepestDeepestDeepestDeeperTimers;
    residualDeepestDeepestDeepestDeepestDeeperDurationMs?: number;
  };

function clearMinimapIntelScrollSyncResidualDeepestDeepestDeepestDeepestDeeperRing(
  layoutFrame: HTMLElement | null | undefined,
  intelRoot: ParentNode | null | undefined,
  marchId: number | null,
): void {
  layoutFrame?.classList.remove(
    MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
  );
  if (intelRoot != null && marchId != null && marchId > 0) {
    intelRoot
      .querySelector<HTMLElement>(
        `.march-list li[data-march-id="${Math.trunc(marchId)}"].${MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS}`,
      )
      ?.classList.remove(
        MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
      );
  }
}

export type BeginMinimapIntelScrollSyncResidualDeepestDeepestDeepestDeepestDeeperRingOptions = {
  durationMs?: number;
  timers?: MinimapViewportIntelScrollResidualDeepestDeepestDeepestDeepestDeeperTimers;
  marchId?: number | null;
};

/** 在 CLIENT-364 `minimap-intel-scroll-sync-residual-deepest-deepest-deepest-deeper-ring` 之上叠加 residual deepest-deepest-deepest-deepest-deeper ring 1.5s。 */
export function beginMinimapIntelScrollSyncResidualDeepestDeepestDeepestDeepestDeeperRing(
  layoutFrame: HTMLElement | null | undefined,
  intelRoot: ParentNode | null | undefined,
  options?: BeginMinimapIntelScrollSyncResidualDeepestDeepestDeepestDeepestDeeperRingOptions,
): void {
  const duration =
    options?.durationMs ??
    MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_MS;
  const timers = options?.timers;
  const marchId =
    options?.marchId != null && Number.isFinite(options.marchId) && options.marchId > 0
      ? Math.trunc(options.marchId)
      : null;

  if (timers?.residualDeepestDeepestDeepestDeepestDeeperRingClassTimer) {
    clearTimeout(timers.residualDeepestDeepestDeepestDeepestDeeperRingClassTimer);
    timers.residualDeepestDeepestDeepestDeepestDeeperRingClassTimer = null;
  }
  clearMinimapIntelScrollSyncResidualDeepestDeepestDeepestDeepestDeeperRing(
    layoutFrame,
    intelRoot,
    marchId,
  );
  if (!layoutFrame && !intelRoot) return;

  if (layoutFrame) {
    layoutFrame.classList.add(
      MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
    );
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
    if (
      layoutFrame.classList.contains(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS)
    ) {
      /* CLIENT-332 residual deepest-deepest-deeper ring 须并存 */
    }
    if (
      layoutFrame.classList.contains(
        MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS,
      )
    ) {
      /* CLIENT-348 residual deepest-deepest-deepest ring 须并存 */
    }
    if (
      layoutFrame.classList.contains(
        MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
      )
    ) {
      /* CLIENT-364 residual deepest-deepest-deepest-deeper ring 须并存 */
    }
  }
  if (intelRoot && marchId != null) {
    const row = intelRoot.querySelector<HTMLElement>(
      `.march-list li[data-march-id="${marchId}"]`,
    );
    row?.classList.add(
      MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
    );
    void row?.offsetWidth;
  }

  if (timers && duration > 0) {
    timers.residualDeepestDeepestDeepestDeepestDeeperRingClassTimer = setTimeout(() => {
      timers.residualDeepestDeepestDeepestDeepestDeeperRingClassTimer = null;
      clearMinimapIntelScrollSyncResidualDeepestDeepestDeepestDeepestDeeperRing(
        layoutFrame,
        intelRoot,
        marchId,
      );
    }, duration);
  }
}

/**
 * 军情行变更：CLIENT-364 scroll-sync 残余巩固再加深五层 + residual deepest-deepest-deepest-deepest-deeper ring 1.5s（CLIENT-380）。
 */
export function syncMinimapViewportIntelScrollResidualDeepestDeepestDeepestDeepestDeeper(
  input: SyncMinimapViewportIntelScrollResidualInput,
  options?: SyncMinimapViewportIntelScrollResidualDeepestDeepestDeepestDeepestDeeperOptions,
): SyncMinimapViewportToIntelRowResult {
  const viewportResult = syncMinimapViewportIntelScrollResidualDeepestDeepestDeepestDeeper(
    input,
    options,
  );

  const march = input.march;
  const marchId = march?.march_id;
  if (viewportResult.applied && marchId != null && Number.isFinite(marchId) && marchId > 0) {
    beginMinimapIntelScrollSyncResidualDeepestDeepestDeepestDeepestDeeperRing(
      input.layoutFrame,
      input.intelRoot,
      {
        durationMs:
          options?.residualDeepestDeepestDeepestDeepestDeeperDurationMs ??
          MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_MS,
        timers: options?.residualDeepestDeepestDeepestDeepestDeeperTimers,
        marchId: Math.trunc(marchId),
      },
    );
  }

  return viewportResult;
}

/** @internal vitest */
export function resetMinimapViewportIntelScrollResidualDeepestDeepestDeepestDeepestDeeperTimersForTests(
  timers: MinimapViewportIntelScrollResidualDeepestDeepestDeepestDeepestDeeperTimers,
): void {
  if (timers.residualDeepestDeepestDeepestDeepestDeeperRingClassTimer) {
    clearTimeout(timers.residualDeepestDeepestDeepestDeepestDeeperRingClassTimer);
    timers.residualDeepestDeepestDeepestDeepestDeeperRingClassTimer = null;
  }
}

/** @internal vitest — CLIENT-364 deepest-deepest-deepest-deeper timers 仍由调用方管理 */
export type { MinimapViewportIntelScrollResidualDeepestDeepestDeepestDeeperTimers };

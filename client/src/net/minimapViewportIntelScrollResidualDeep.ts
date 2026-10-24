import {
  MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_CLASS,
  syncMinimapViewportIntelScrollResidual,
  type MinimapViewportIntelScrollResidualTimers,
  type SyncMinimapViewportIntelScrollResidualInput,
  type SyncMinimapViewportIntelScrollResidualOptions,
} from "@/net/minimapViewportIntelScrollResidual";
import { MINIMAP_INTEL_SYNC_RING_CLASS } from "@/ui/minimapIntelSyncHighlight";
import type { SyncMinimapViewportToIntelRowResult } from "@/net/minimapViewportIntelSync";

/** CLIENT-268：军情 scroll-sync 残余巩固加深环（叠 CLIENT-252 deep ring；CLIENT-220 双向环不退化）。 */
export const MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEP_RING_CLASS =
  "minimap-intel-scroll-sync-residual-deep-ring";

export const MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEP_RING_MS = 1500;

export type MinimapViewportIntelScrollResidualDeepTimers = {
  residualDeepRingClassTimer: ReturnType<typeof setTimeout> | null;
};

export function createMinimapViewportIntelScrollResidualDeepTimers(): MinimapViewportIntelScrollResidualDeepTimers {
  return { residualDeepRingClassTimer: null };
}

export type SyncMinimapViewportIntelScrollResidualDeepOptions =
  SyncMinimapViewportIntelScrollResidualOptions & {
    residualDeepTimers?: MinimapViewportIntelScrollResidualDeepTimers;
    residualDeepDurationMs?: number;
  };

function clearMinimapIntelScrollSyncResidualDeepRing(
  layoutFrame: HTMLElement | null | undefined,
  intelRoot: ParentNode | null | undefined,
  marchId: number | null,
): void {
  layoutFrame?.classList.remove(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEP_RING_CLASS);
  if (intelRoot != null && marchId != null && marchId > 0) {
    intelRoot
      .querySelector<HTMLElement>(
        `.march-list li[data-march-id="${Math.trunc(marchId)}"].${MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEP_RING_CLASS}`,
      )
      ?.classList.remove(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEP_RING_CLASS);
  }
}

export type BeginMinimapIntelScrollSyncResidualDeepRingOptions = {
  durationMs?: number;
  timers?: MinimapViewportIntelScrollResidualDeepTimers;
  marchId?: number | null;
};

/** 在 CLIENT-252 `minimap-intel-scroll-sync-deep-ring` 之上叠加 residual deep ring 1.5s。 */
export function beginMinimapIntelScrollSyncResidualDeepRing(
  layoutFrame: HTMLElement | null | undefined,
  intelRoot: ParentNode | null | undefined,
  options?: BeginMinimapIntelScrollSyncResidualDeepRingOptions,
): void {
  const duration = options?.durationMs ?? MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEP_RING_MS;
  const timers = options?.timers;
  const marchId =
    options?.marchId != null && Number.isFinite(options.marchId) && options.marchId > 0
      ? Math.trunc(options.marchId)
      : null;

  if (timers?.residualDeepRingClassTimer) {
    clearTimeout(timers.residualDeepRingClassTimer);
    timers.residualDeepRingClassTimer = null;
  }
  clearMinimapIntelScrollSyncResidualDeepRing(layoutFrame, intelRoot, marchId);
  if (!layoutFrame && !intelRoot) return;

  if (layoutFrame) {
    layoutFrame.classList.add(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEP_RING_CLASS);
    void layoutFrame.offsetWidth;
    if (layoutFrame.classList.contains(MINIMAP_INTEL_SYNC_RING_CLASS)) {
      /* CLIENT-220 双向环须并存 */
    }
    if (layoutFrame.classList.contains(MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_CLASS)) {
      /* CLIENT-252 deep ring 须并存 */
    }
  }
  if (intelRoot && marchId != null) {
    const row = intelRoot.querySelector<HTMLElement>(
      `.march-list li[data-march-id="${marchId}"]`,
    );
    row?.classList.add(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEP_RING_CLASS);
    void row?.offsetWidth;
  }

  if (timers && duration > 0) {
    timers.residualDeepRingClassTimer = setTimeout(() => {
      timers.residualDeepRingClassTimer = null;
      clearMinimapIntelScrollSyncResidualDeepRing(layoutFrame, intelRoot, marchId);
    }, duration);
  }
}

/**
 * 军情行变更：CLIENT-252 scroll-sync 残余 + residual deep ring 1.5s（CLIENT-268）。
 */
export function syncMinimapViewportIntelScrollResidualDeep(
  input: SyncMinimapViewportIntelScrollResidualInput,
  options?: SyncMinimapViewportIntelScrollResidualDeepOptions,
): SyncMinimapViewportToIntelRowResult {
  const viewportResult = syncMinimapViewportIntelScrollResidual(input, options);

  const march = input.march;
  const marchId = march?.march_id;
  if (viewportResult.applied && marchId != null && Number.isFinite(marchId) && marchId > 0) {
    beginMinimapIntelScrollSyncResidualDeepRing(input.layoutFrame, input.intelRoot, {
      durationMs: options?.residualDeepDurationMs ?? MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEP_RING_MS,
      timers: options?.residualDeepTimers,
      marchId: Math.trunc(marchId),
    });
  }

  return viewportResult;
}

/** @internal vitest */
export function resetMinimapViewportIntelScrollResidualDeepTimersForTests(
  timers: MinimapViewportIntelScrollResidualDeepTimers,
): void {
  if (timers.residualDeepRingClassTimer) {
    clearTimeout(timers.residualDeepRingClassTimer);
    timers.residualDeepRingClassTimer = null;
  }
}

/** @internal vitest — CLIENT-252 residual timers 仍由调用方管理 */
export type { MinimapViewportIntelScrollResidualTimers };

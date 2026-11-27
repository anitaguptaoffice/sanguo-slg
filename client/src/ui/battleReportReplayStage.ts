import type { BattleRoundView } from "@/net/militaryFormat";
import {
  BATTLE_REPLAY_INITIAL,
  battleReplayTickIntervalMs,
  formatReplayRoundCaption,
  reduceBattleReplayState,
  sumUnitMap,
  troopBarPercent,
  type BattleReplaySpeed,
  type BattleReplayState,
} from "@/net/battleReportReplay";

export type BattleReportReplayMount = {
  root: HTMLElement;
  dispose: () => void;
  getState: () => BattleReplayState;
  setRounds: (rounds: BattleRoundView[]) => void;
};

const SPEEDS: BattleReplaySpeed[] = [1, 2, 4];

export function mountBattleReportReplayStage(
  parent: HTMLElement,
  rounds: BattleRoundView[],
): BattleReportReplayMount {
  const root = document.createElement("section");
  root.className = "battle-report-replay-stage";
  root.setAttribute("aria-label", "战斗可视化回放");
  root.innerHTML = `
    <div class="battle-replay-stage-head">
      <span class="battle-replay-stage-title">战斗回放</span>
      <div class="battle-replay-bars" data-role="replay-bars"></div>
      <div class="battle-replay-lane" data-role="replay-lane" aria-hidden="true">
        <span class="battle-replay-lane-att" data-role="lane-att"></span>
        <span class="battle-replay-lane-ruler" data-role="lane-ruler"></span>
        <span class="battle-replay-lane-def" data-role="lane-def"></span>
      </div>
      <p class="battle-replay-caption" data-role="replay-caption"></p>
    </div>
    <div class="battle-replay-controls" data-role="replay-controls" role="toolbar" aria-label="回放控制"></div>
  `;
  parent.prepend(root);

  let state: BattleReplayState = { ...BATTLE_REPLAY_INITIAL };
  let currentRounds = rounds;
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  const baselineAtt = sumUnitMap(rounds[0]?.attacker_units ?? rounds[0]?.attacker_troops);
  const baselineDef = sumUnitMap(rounds[0]?.defender_units ?? rounds[0]?.defender_troops);

  const captionEl = root.querySelector<HTMLElement>("[data-role='replay-caption']")!;
  const barsEl = root.querySelector<HTMLElement>("[data-role='replay-bars']")!;
  const laneAtt = root.querySelector<HTMLElement>("[data-role='lane-att']")!;
  const laneDef = root.querySelector<HTMLElement>("[data-role='lane-def']")!;
  const laneRuler = root.querySelector<HTMLElement>("[data-role='lane-ruler']")!;
  const controls = root.querySelector<HTMLElement>("[data-role='replay-controls']")!;

  const clearTick = () => {
    if (tickTimer != null) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  };

  const scheduleTick = () => {
    clearTick();
    if (!state.playing) return;
    tickTimer = setInterval(() => {
      state = reduceBattleReplayState(state, { type: "tick" }, currentRounds.length);
      paint();
      if (!state.playing) clearTick();
    }, battleReplayTickIntervalMs(state.speed));
  };

  const paint = () => {
    const round = currentRounds[state.roundIndex];
    captionEl.textContent = state.atSettlement
      ? "战斗已结束"
      : formatReplayRoundCaption(round);
    const attPct = troopBarPercent(
      round?.attacker_units ?? round?.attacker_troops,
      Math.max(1, baselineAtt),
    );
    const defPct = troopBarPercent(
      round?.defender_units ?? round?.defender_troops,
      Math.max(1, baselineDef),
    );
    barsEl.innerHTML = `
      <div class="battle-replay-bar battle-replay-bar--att" style="width:${attPct}%">攻方兵力 ${attPct}%</div>
      <div class="battle-replay-bar battle-replay-bar--def" style="width:${defPct}%">守方兵力 ${defPct}%</div>
    `;
    const dist = round?.distance;
    const lanePct =
      dist === undefined ? 50 : Math.min(95, Math.max(5, Math.round(Number(dist) * 4 + 50)));
    laneAtt.style.left = `${Math.max(5, lanePct - 18)}%`;
    laneDef.style.right = `${Math.max(5, 100 - lanePct - 18)}%`;
    laneRuler.textContent = dist === undefined ? "距离 —" : `距离 ${dist}`;
    controls.querySelectorAll("[data-replay-speed]").forEach((btn) => {
      btn.classList.toggle(
        "active",
        Number((btn as HTMLButtonElement).dataset.replaySpeed) === state.speed,
      );
    });
    const playBtn = controls.querySelector<HTMLButtonElement>('[data-action="replay-toggle"]');
    if (playBtn) playBtn.textContent = state.playing ? "暂停" : "播放";
  };

  const dispatch = (event: Parameters<typeof reduceBattleReplayState>[1]) => {
    state = reduceBattleReplayState(state, event, currentRounds.length);
    paint();
    scheduleTick();
  };

  controls.innerHTML = `
    <button type="button" class="product-btn-ghost" data-action="replay-toggle">播放</button>
    ${SPEEDS.map(
      (s) =>
        `<button type="button" class="product-btn-ghost battle-replay-speed-btn" data-replay-speed="${s}" data-action="replay-speed">${s}x</button>`,
    ).join("")}
    <button type="button" class="product-btn-ghost" data-action="replay-prev">上一回合</button>
    <button type="button" class="product-btn-ghost" data-action="replay-next">下一回合</button>
    <button type="button" class="product-btn-ghost" data-action="replay-settlement">跳到结算</button>
  `;
  controls.addEventListener("click", (ev) => {
    const btn = (ev.target as Element).closest<HTMLButtonElement>("button[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === "replay-toggle") dispatch({ type: "toggle-play" });
    if (action === "replay-prev") dispatch({ type: "prev-round" });
    if (action === "replay-next") dispatch({ type: "next-round" });
    if (action === "replay-settlement") dispatch({ type: "jump-settlement" });
    if (action === "replay-speed") {
      const speed = Number(btn.dataset.replaySpeed) as BattleReplaySpeed;
      if (speed === 1 || speed === 2 || speed === 4) dispatch({ type: "set-speed", speed });
    }
  });

  if (!currentRounds.length) {
    root.classList.add("battle-report-replay-stage--empty");
    captionEl.textContent = "暂无回合数据可回放";
  } else {
    paint();
  }

  return {
    root,
    getState: () => ({ ...state }),
    setRounds: (next) => {
      currentRounds = next;
      state = { ...BATTLE_REPLAY_INITIAL };
      clearTick();
      if (!next.length) {
        root.classList.add("battle-report-replay-stage--empty");
        captionEl.textContent = "暂无回合数据可回放";
      } else {
        root.classList.remove("battle-report-replay-stage--empty");
        paint();
      }
    },
    dispose: () => {
      clearTick();
      root.remove();
    },
  };
}
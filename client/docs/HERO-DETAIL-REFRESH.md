# CLIENT-HERO-DETAIL-REFRESH-001

Issue #2323. Stage 1 is test-only on cbdd409b66f48942071f8b793494d5f4af14d6a9.
The production HeroMailPanels is mounted with a mocked network boundary and mutable
session, opened through toggleHero and its real hero-list click handler. No private
state or renderer is mocked. Tests invoke public refreshRecruitAffordability.

Baseline command: npm test -- src/ui/HeroMailPanels.detailRefresh.test.ts
Result: 3 failing tests, 1 passing control. All 13 failed assertions concern original
control identity/connection/focus. All wallet/bag/selection assertions execute and pass.
Three unchanged refreshes retain the detail container but replace/disconnect the gold
radio and lose its focus. Food 500→50→700 and gold 0→1000→0 correctly update visible
cost summaries and submit availability, but replace the focused radio. Removing selected
item 2052 while increasing 2051 stock preserves selected value and disables submission,
but replaces the focused select. Selecting another hero legitimately loads new detail;
hidden and detached public refresh controls pass. These are JSDOM production-path proofs,
not proof of the precise historical native event ordering or native acceptance.

## Proposed design for independent review (not implemented)

Scope preservation to public affordability refresh of the same loaded hero. Ordinary
selection/loading/error/detail-result renders must retain their current replacement
behavior. A whole-markup equality shortcut alone is insufficient: real food balance
changes update the cost summary even when all controls should retain identity.
Prefer synchronizing economy-dependent text/attributes and existing interactive control
properties in place from the same authoritative render inputs. Preserve checked radio,
selected item and hours semantics, including a now-unavailable selected item. Do not
skip legitimate affordability, bag counts, disabled reasons, cooldown or progress data.
Do not detach/reinsert the focused subtree, call focus(), or restore focus afterward.
Existing artwork/residual-owned nodes must not be accidentally reconciled as template
nodes. Existing rendering controls already expose several targeted sync helpers, but
those helpers alone do not update every bag option, hint or disabled-reason paragraph.

Before implementation, independently choose/review a bounded detail-only update method
that covers these gaps and preserves non-largess focused controls, or narrow the card
explicitly. Do not introduce a general overlay/global DOM morph utility. Additional
regressions should cover detail/template changes, artwork/residual compatibility and
focused controls beyond largess once the update method is selected. Source repair must
stay within the registered three paths and 400-line total. Held #2004/#2065 are excluded.

## Concrete bounded update proposal, pending review

Public refresh calls renderTemplateList(true), forwarding economyRefresh through
applyTemplateSelection to its original nested renderHeroList, then retains the original
second public renderHeroList(true). Both actual renders are guarded; no artificial sync
is added. Existing skipHeroListRender semantics and all ordinary defaults remain unchanged.
This preserves first-collapse focus transfer and second already-closed no-refocus behavior.
Cache the last full-rendered detail
container, selected hero ID, detail object and JSON fingerprint of detail/template/list
context, plus submit states, gift mode, selected item and recruit bag readiness/error.
Exclude hours from this fingerprint: actual hour clicks update preference and sync controls
without rendering; bounded Expr sync must use the current preference. Bag readiness/error
can switch the recruitment summary between raw status text and structured paragraphs.
Invalidate on every
non-loaded branch; normal renderHeroList calls never use the fast path. Changed identity,
template/detail/state/selection fingerprint, missing required targets, or unsupported
structure falls back to the existing full render before any partial writes. Hidden public
refresh remains inert; visible disconnected refresh is supported as detached rendering,
not a focus guarantee (new control checks it does not throw and retains rendered Lv1).

For same-loaded-detail refresh, build the same authoritative full markup off-DOM. Plan
all bounded writes first, then apply only the following owned regions:
- recruit-afford-primary/secondary paragraphs: text and recruit-cost-deficit class.
- hero-upgrade-item-gap paragraphs keyed by data-kind: text and gap-warn class.
- hero-detail-consumable-stack-line and hero-detail-consumable-stack-residual-line:
  text/deficit class; allow optional insertion/removal immediately before the recruitment
  summary (or attribute table) without touching surrounding interactive nodes.
- hero-cultivation-item-hint and hero-cultivation-disabled-reason: text/hidden class;
  hero-use-cultivation-item button: disabled and label from fresh markup.
- hero-largess-gold-hint/item-hint/cd/disabled-reason: text and hidden class;
  hero-largess-submit: disabled and label. Preserve both radio nodes and checked values.
- hero-largess-item select: preserve node/value; update existing options keyed by value,
  only text and disabled from fresh markup. Option membership is fixed by the renderer;
  unexpected membership mismatch must trigger preflight fallback. No replacing options.
- Use existing syncHeroDetailExprControls for summary, hour selection/disabled/aria-pressed,
  begin/cancel/finish/faster disabled/labels/reasons and current-time changes. It preserves
  live hour buttons. Other upgrade/force/points controls have no economy dependency and
  remain unchanged under the fingerprint guard.

Do not traverse arbitrary descendants or reconcile art. Do not touch header/bust, attribute
rows, navigation buttons, form-error/success nodes, or asynchronous residual-owned children.
Continue existing recruitment disclosure sync, cooldown setup and bag residual schedules;
only skip full detail innerHTML replacement and repeated bust mount for this guarded path.
Public template/list/other-panel refresh still runs. Selection/detail/template changes keep
normal full rendering. Tests must verify optional bag rows, non-largess hour identity,
art/residual and status preservation, changed guard fallback, and all legitimate UI updates.

Stage-1 revision adds actual rendered Lv2 after new selection, separate visible-disconnected
public refresh control, and focused selected-hour preservation. Baseline is now 4 RED / 2
PASS, exactly 15 soft identity/focus failures; data/control assertions still all execute.

## Implementation candidate

The approved bounded plan is now implemented; nine mounted tests pass locally, including
optional row add/remove, training and cultivation guards, retained art/residual/status
nodes, same-id changed detail and preflight failure before any partial write. No native
causality/acceptance claim follows. Full tests/build and independent final review remain
required before publication. Historical stage-1 RED commits and logs remain immutable.

Composition review found the original collapse-focus suite deliberately exercises both
real render checkpoints. The initial suppression candidate failed those two assertions;
that failure remains recorded. The approved amendment preserves both guarded renders,
without changing the historical test or weakening its focus-once/state assertions.

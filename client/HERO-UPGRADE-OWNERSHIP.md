# Hero upgrade command ownership

CLIENT-HERO-UPGRADE-OWNERSHIP-001 / #2029. Only UpgradeHero command handling, not other cultivation commands.

Baseline actual DOM: upgrade hero7 then select hero8; hero7's reply overwrites the detail identity while retaining Hero8's name and selected row. A late upgrade can also regress a newer read of the same hero. Ten baseline regressions failed; earlier ownership tests covered reads only.

Pending transport records are keyed by hero and carry the captured actor/token/session generation. Selected-hero controls derive their pending state from this record: B may upgrade while A waits, but A→B→A cannot issue a duplicate A upgrade. Identity-safe cleanup cannot release another actor's newer same-ID request.

Presentation separately requires the original actor, detail-read generation, selected/detail identity, mounted panel and foreground intent. Response hero_id must match the submitted target. Current success/error keep existing behavior; obsolete replies do not replace another hero, publish old status or navigate back. If the same actor currently views A through a newer detail read when A's upgrade succeeds, perform a fresh ownership-guarded GetHeroDetail rather than replay an older upgrade snapshot. This is a read, not a retry or reversal of the upgrade.

Already submitted operations may have executed on the server. The client does not cancel, undo or automatically resend them. Current UpgradeHero spends hero experience and returns hero fields; its current handler/service has no wallet/bag delta. This rule must not be generalized to adjacent item/gold-consuming actions. Add/clear points also need separate actor-owned snapshot handling because GetHeroDetail omits allocations; those mutation flows remain outside this card.

Tests exercise actual DOM buttons, A/B overlap, ABA duplicate suppression, stale success/error, same-ID relogin, newer same-hero detail, close/back/detach/peer panels, response mismatch and retry. Mocked gateway DOM is not live/browser acceptance. Full client/build, independent final-tree review, exact-head required CI and main CI remain gates.

Held #2004 shares HeroMailPanels.ts but modifies mail pagination; no held branch/hold is changed. The exact held head adc2c9e56b2e1d1134f648e3d0d6b4f22f37f6ae was combined only in a temporary tree: the prior detail-read card causes an adjacent detach conflict, resolved by retaining list-lock reset, detail invalidation and mailReadVersion increment. 83 combined tests and build passed. This is not clean auto-apply; future integration must preserve all three statements and revalidate, without lifting its hold. No backend/protocol/layout/data/CI/permissions/deployment changes.

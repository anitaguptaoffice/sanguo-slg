# CLIENT-HERO-MARCH-FORCE-FRESHNESS-001

Task #2021. Hero details/rest persist a current/max stamina snapshot with updatedAtMs.
Previously the march form treated low cached stamina as permanent authority. A normal
9/24 detail snapshot blocked the real march button and StartMarch even 24 hours later;
ListPlayerHeroes refresh does not provide stamina, and no production path clears the cache.

The hard-blocking hint is now valid for less than 180,000ms. At that age or later, or when
the timestamp is absent/invalid/nonpositive/future, validation defers to the existing
StartMarch server checks. Clock rollback therefore cannot lock the form indefinitely.
Fresh insufficient values still show the existing hint; current/max are never modified,
no passive regeneration is simulated, and expiry never automatically submits a march.

This is a cache-authority timeout, NOT an accurate recovery countdown. The server's
LastRegenAt is not in this response and may already have fractional-period progress;
cross-tab rest can also make the cached shortage obsolete sooner. A valid fresh snapshot
can therefore impose up to 180 seconds of extra blocking. Expiry means 'ask the server',
not 'enough stamina'. Backend ClaimForMarch/ConsumeMarchForceOnce still verifies hero
ownership/status and applies real regeneration before checking the cost. No RPC or
backend/protocol changes, and no changes to the actual 180-second server regen rule.

The existing MainCityScene update loop recalculates visible military controls, so the
button can recover without new scene code. Actual-scene tests prove fresh rejection,
expiry enabling the existing submission, and an insufficient-force server reply remaining
an error with no arrival tracking/success. Time-boundary, old-cache, rollback and no-mutation
tests cover the helper. Legacy fresh tests now use current timestamps instead of epoch1.
These are DOM/mocked-gateway integration tests, not browser/live or real-server acceptance.
Full tests/build, independent final-tree review and exact-head CI remain required.

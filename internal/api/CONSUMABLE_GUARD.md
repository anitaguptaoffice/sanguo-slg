# API-CONSUMABLE-GUARD — prevent unapplied item effects

`UseConsumable` cannot apply the hero recruitment or troop training effects
returned by `content.Use`. Previously those types removed stock and returned a
placeholder success without creating a hero or applying troops.

The authenticated handler now checks the **exact service/catalog binding** installed
by `WireM4Content` before `LoadPlayer` or `Use`. Item types `Recruit` and
`TrainTroop` return a non-success packet with no success payload and an explicit
“未扣除道具” message. Recruitment directs players to the existing hero recruitment
entry point. No city target, free recruitment, new SKU, cost, or protocol is invented.
Speedups lacking a valid `build` target are likewise rejected before hydration:
this API has no research, troop, or march speedup consumer. All four default
speedups retain their build target. Unknown items/types and missing, incomplete,
or rewired catalog bindings fail closed; local-memory test fixtures must explicitly bind their actual catalog too.

This guard does not alter CONTENT or either dedicated recruitment route.
`RecruitHero` retains its atomic resource/item/hero transaction; `RecruitTroop`
retains its existing city-specific paid recruitment path. Resource packs and build
speedups retain their prior semantics, including the existing no-active-build
behavior. The separate existing speedup failure window is unchanged: item removal commits before the
DOM update, and a failed `ApplyBuildSpeedup` can return zero without undoing the
item debit. Closing that window requires a separate atomicity/target contract;
this card neither redesigns it nor disables working build effects.
A future implementation of these rejected effect types needs its own reviewed
city-target/effect/transaction contract before direct consumable use is enabled.

Coverage: authenticated real-PG router requests for every default Recruit/Train
item (11), test-only alternate IDs of both types, eight quantity boundaries,
unknown/unbound/rewired wiring, unsupported speedup targets, exact durable
bag/wallet/hero/troop/quest/queue/city and in-memory cache preservation, plus
resource packs and all four supported default build speedups. Existing
atomic hero recruitment and paid troop recruitment tests remain regression gates.

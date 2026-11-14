# ServerSelect authorized scope read-only display

CLIENT-FIRST-CITY-AUTHORIZED-SCOPE-001 stacks on #2730.

Loopback ServerSelect V2 first-city panel shows **read-only** server-derived `knowledge.scope` after Discover
([FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §2). Submit/Continue/Get `expectedScope` must match this view;
it is not execution authorization. Outcome, conflict, stale-actor, and commander rows stay separate. No auto Submit/Continue or main-city entry.

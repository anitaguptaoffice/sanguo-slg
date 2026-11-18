# Durable arrival integration (default OFF)

`Resolver.EnableDurableArrival(pool.BeginTx, transition)` is explicit opt-in.
Configure before installing `HubHandler`; production `WireM2Combat` is unchanged.
The resolver owns the outer transaction. MarchTransition owns its savepoint;
reports, survivors and SQL march/army state commit before defenders are published.
No battle returns every troop; annihilation ends in PhaseReturned without a return.
Both resolver and Hub freeze the return deadline from the order's ArriveAt.

For the prepared runtime, first install durable return credit, then call
`Hub.SetPreparedMarchArrivalHandler(resolver.HubHandler())` before activating
restore. This Hub accepts committed departures only. Each arrival passes an
isolated order and troop snapshot to the resolver outside the Hub mutex.
Prepared resolutions run in series for the shared defender garrisons. The Hub
publishes confirmed survivors before scheduling return or notifying terminal
completion, and terminal notifications can read the Hub.

Hub exposes failures through `MarchArrivalError`. Failed arrivals retain marching
memory, do not finish, and are quarantined without automatic retry. An uncertain
outer commit must be reconciled from persisted state before recovery/reinstallation;
replaying an already committed arrival is not a safe retry strategy.

This does not persist defender garrisons or credit city_troop. Do not enable the
production route before the separately tracked return-credit and activation gates.
Unit transaction doubles are not PostgreSQL acceptance: PG17 ordinary and race
arrival/report/restart/rollback checks remain required and this work stays HOLD
until their real execution evidence and independent review are available.

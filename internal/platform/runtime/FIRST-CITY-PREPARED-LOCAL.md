# Local prepared first city

Use `SANGUO_FIRST_CITY_USE_PREPARED_CITY=1` with a loopback HTTP listener,
an independently owned isolated PostgreSQL 17 source, reviewed prepared
DDL already installed and `MIL_FRESH_PROFILE_FILE` format 1. The profile
must contain the exact 29 WORLD, DOM and MIL objects of that source.
The 14-object MIL-only profile remains usable outside this mode.

An invalid opted-in profile stops startup. The local gateway omits legacy
create, recruit and march writes and GM HTTP routes. The legacy military
scheduler stays stopped. Use an exclusive database with no other game or
maintenance writers.

`SANGUO_PREPARED_RECRUIT=1` additionally enables authenticated Recruit V2 and
the durable due worker. This requires prepared first-city and the exact
40-object profile including the 11 ACCOUNT objects. A 29-object first-city
profile still works without the Recruit opt-in. March requires its own wiring.

The prepared gateway selects `sanguo.recruit-v2` when offered on `/ws`.
Selection is a transport capability; every Recruit V2 request still needs
the authenticated actor and live source. The existing handshake is used by
clients that offer no subprotocol.

Stopping the prepared service cancels gateway requests and the due worker.
The runtime waits up to 15 seconds for the worker to exit before closing
its PostgreSQL pool. Pool close has a separate 5-second deadline. Either
runtime timeout is reported as a server error. Check the worker log for a
source drain warning before handing this database to another writer.

# Local prepared first city

Use `SANGUO_FIRST_CITY_USE_PREPARED_CITY=1` with a loopback HTTP listener,
an independently owned isolated PostgreSQL 17 source, reviewed prepared
DDL already installed and `MIL_FRESH_PROFILE_FILE` format 1. The profile
must contain the exact 29 WORLD, DOM and MIL objects of that source.
The 14-object MIL-only profile remains usable outside this mode.

An invalid opted-in profile stops startup. The local gateway omits legacy
create, recruit and march writes and GM HTTP routes. The legacy military
scheduler stays stopped. Use an exclusive database with no other game or
maintenance writers. Recruit and march activation require their own wiring.

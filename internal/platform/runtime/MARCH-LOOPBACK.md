# Local durable marches

Set `SANGUO_PREPARED_MARCH=1` together with
`SANGUO_FIRST_CITY_USE_PREPARED_CITY=1` and `SANGUO_PREPARED_RECRUIT=1`.
The HTTP listener and PostgreSQL source use loopback. Supply the reviewed
format-1 profile through `MIL_FRESH_PROFILE_FILE`. Provision the isolated
development schema and map before enabling the option. The source has 49
expected objects, including the nine march/army relations and indexes.

Run the server on an isolated source without other or legacy writers. Startup
takes a PostgreSQL session lease for the schema, verifies those identities
and opens the prepared source without running the development migrations
or seeding. The process retains the lease through worker shutdown and pool close.
Losing it stops the local listener and workers. Start the next process after
the previous one exits so it can restore persisted arrivals and returns.

# Publish a committed prepared march

After confirming the transaction that debited ready troops and called
`MarchStore.Create`, APP binds the player and hero views and calls
`Hub.PublishCommittedMarch` with the same payload and returned IDs.
Publication mirrors the PostgreSQL timestamp precision. It updates the
field order and schedules one arrival, using the staged event list until
the already restored Hub is activated. It uses no city stock or legacy
ID allocation.

A failed publication leaves the confirmed transaction in PostgreSQL.
Recover the database order on restart. The caller must never compensate a
confirmed debit or issue another march as a publication retry.

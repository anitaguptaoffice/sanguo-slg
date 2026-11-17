# Actual completion promotion rollback

Task API-RECRUIT-COMPLETE-ROLLBACK-PG-001 (#3081). The two cases use actual
paid admission and the private completion caller against PostgreSQL17. An owned
time fixture shifts both queue and receipt timestamps by one hour, preserves all
non-time fields and exact durations, and checks affected row counts. No natural
waiting, production clock change or runtime activation is claimed.

The successful control proves this fixture really credits stock and promotes the
waiting job. The negative case observes provisional credit/done on the caller and
unchanged state from another connection, then installs a transaction-local
trigger that makes the real promotion UPDATE fail. Rollback must preserve the
entire durable snapshot, clear tentative completion, drain the lease and retain
the exact completion diagnostic. This does not replace commit ACK-loss/panic
coverage, which is a separate remaining acceptance gate for the completion stack.

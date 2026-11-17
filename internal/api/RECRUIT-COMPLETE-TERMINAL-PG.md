# Completion terminal ownership

API-RECRUIT-COMPLETE-TERMINAL-PG-001 (#3083) calls actual paid completion in a
bounded child process. It observes provisional credit/done/promotion before
primary-plus-rollback panic, COMMIT-start panic, COMMIT-end panic or a real deferred
unique rejection at COMMIT. Independent PG state distinguishes committed credit
from rollback; caller uncertainty remains quarantined in both cases.

Every case first checks real Early, then uses #3082's owned timestamp advancement.
There is no business-duration wait. A 20ms deadline probes that the unresolved
lease cannot drain; parent/child and transport cleanup have independent bounds.
The parent reaps the child and drops only its emitted isolated schema. Physical
socket cleanup never becomes invented transaction/lease resolution.

This is not network ACK-loss proof and does not enable the dormant runtime.

# ServerSelect durable head predecessor read-only display

CLIENT-FIRST-CITY-HEAD-PREDECESSOR-001 stacks on #2736.

Loopback ServerSelect V2 first-city panel shows **read-only** `proposal.predecessor` on the durable `head` command
([FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §3): EMPTY or `rejected_command_id`.
This is not actor discovery EMPTY, command lookup NOT_OBSERVED, or canonical winner summary.
Authorized scope, TemplateRef, outcomes, and stale-actor isolation stay separate.
No automatic Submit/Continue or main-city entry; this row does not change submit predecessor construction.

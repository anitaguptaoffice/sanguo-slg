# Actual completion acknowledgement loss

API-RECRUIT-COMPLETE-NETWORK-PG-001 (#3085) uses the existing protocol-only PG
proxy with the actual completion caller. One real paid job first returns Early;
then an owned queue/receipt timestamp shift preserves non-time fields and duration.
Normal reply confirms completion. Lost and fragmented server COMMIT replies prove
durable credit while the caller remains UNKNOWN. A pre-COMMIT cut proves unchanged
durable state with the same caller uncertainty. Parsed CommandComplete and idle
ReadyForQuery frames are real server bytes, not substituted tracer errors.

Every unknown result retains completion identity and a lease that cannot drain;
closed-generation calls cannot retry. Transport cancellation and goroutine joins
are bounded and own exact connection objects. No production durations, runtime
activation or natural-time claim changes. Full combined-stack validation remains
required before merging the dependent product chain.

# Recruit admission rejections

MIL-RECRUIT-REJECTION-001 (#3091) lets the future V2 handler distinguish
request-specific count/capacity/arithmetic and unknown-unit failures from
unavailable stored evidence. `Prepare` first validates the locked stock and
pending queue/receipt evidence. Unsupported versions retain their precedence.
All new rejection outcomes occur before queue ID allocation or writes.

The exact rejection errors also match `ErrRecruitUnavailable` for existing
callers. A future API adapter can map the exact errors to V2 business codes
after confirmed rollback. Wrapped errors and source failures remain
unavailable. Historical lookup and runtime routing are unchanged.

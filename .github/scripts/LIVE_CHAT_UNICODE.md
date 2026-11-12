# CI-CHAT-UNICODE-ACCEPTANCE-001

Issue: https://github.com/anitaguptaoffice/sanguo-slg/issues/2287
Dedicated official Actions QA, Draft/HOLD and never merge this QA into main.
Product source #2285 remains held until its complete native and CI gates pass.
Baseline757e43a9 and fixed95b66a8 use identical native keyboard input paths.
The baseline must lose the final emoji; this is not fixed-product acceptance.
Fixed sends exactly six cases: corrected mixed500, emoji500, ASCII500, Chinese500,
raw whitespace502 trimmed to emoji500, and mixed500 with one newer501 attempt.
Every Send requires matching successful List ID/body/owner/world/server and rendering.
Ordinary drafts clear;501, empty and whitespace rejection retains raw input/storage.
Reopen preserves501. Every counter is the actual raw code-point count.
Pending input is one native appended Z, never a replacement or repeated timing trial.
Trusted passive input and read-only CDP brackets prove strict-before-reply ordering.
Too-fast/ambiguous overlap is UNOBSERVED and fails the full gate; do not rerun for luck.
No delays/interception/mocks/RPC injection, local browser or production access.
Natural waits follow observed service limits inside the runtime's five-minute bound.
Runtime actual6889bc77/tree4e48ea43 and unchanged helper actual7dc5939/tree dc151c55
are separately pinned/copied/compared, with complete pure controls before native work.
Record full actual/local mappings and independent combination review before publication.

Compare every stable persisted message identity/content/destination/time field.
Send/List display names can differ because PGStore does not persist that optional label;
record both values explicitly without treating them as authoritative identity.
Run42430915505 failed at first mixed delivery; no pending attempt was consumed.

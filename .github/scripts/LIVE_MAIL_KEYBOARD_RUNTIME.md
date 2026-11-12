# Mail keyboard native acquisition runtime

CI-MAIL-KEYBOARD-RUNTIME-001 (#2307), fresh reconstruction on ddc80aab, NEVER MERGE.
The prior unpublished 347-line candidate is unavailable and is not this source.
This component owns effects, provenance and acquisition; #2521 owns state policy,
#2309 authenticated traffic/concurrency, and #2308 actual native UI assertions.

Run only the complete independently reviewed workflow on official Ubuntu22.04,
Go1.23.12, PG17, Redis7, Node22, Vite6.4.5 and Playwright1.49.1 Chromium1148.
Each baseline/fixed ×1280/1600 cell starts an empty isolated database/Redis and
normal production server/client. Natural demo bootstrap precedes four real GM
send-mail calls. Empty C/B/A rewards omit the CLI flag; D keeps its one item.
Default CLI stdout must contain exactly the validated lookup/mail audit logs and receipt.
No claim/grant, synthetic RPC, direct fixture SQL, throttling,
clock modification or local browser/service fallback is allowed.

The unchanged lifecycle helper and complete tests are staged from7dc5939f;
only its ownership/deadline/cleanup exports run. All staged implementation,
test and documentation bytes, blob IDs and owning immutable source heads must
match the exact manifest. Product builds/tests before staging; staged files
cannot alter tracked product source. Every CDP frame reaches the trace verifier;
unknown source/socket/opcode, missing/invalid frames or observer errors fail.
GM brackets use CDP Performance Timestamp in the network monotonic clock domain.
SQL snapshots use REPEATABLE READ READ ONLY, including optional-table observations.

The callback gets page, action, fixtures (D/C/B/A with numeric IDs), step(id|null,
callback), screenshot(label), and report. Steps observe quiescent boundaries,
never retry an uncertain action. Runtime rechecks the complete scenario matrix,
then closes the browser with capture active before the final SQL/trace seal;
all owned shutdown and zero-pending requirements remain strict. Evidence keeps
safe raw SQL snapshots, actual GM receipts/brackets, sanitized verifier data,
source/tool/browser provenance and screenshots with empty password fields.
No auth payload, session/trace IDs, raw websocket bytes or arbitrary exception
text is archived. Failure artifacts do not imply acceptance. Even a clean fixed
run is native-candidate/nativeAcceptance=false until independent artifact and
visual review; baseline remains baseline-defect-control. Pure controls are not
native proof. Run node --test live_mail_keyboard_runtime.test.mjs plus the full
unchanged helper suite; final combined tests/CI and four real cells remain gates.

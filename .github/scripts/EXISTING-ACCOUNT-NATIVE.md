# Existing-account native CI

CI-EXISTING-ACCOUNT-NATIVE-001 (#2379), dependent on CLIENT #2380, executes the exact PR head or main push
with Go 1.23.12, PostgreSQL 17, Node 22 and locked Playwright 1.49.1 Chromium
revision 1148. Ubuntu 22.04 runs Chromium with its sandbox enabled, checks actual
namespace/seccomp status and refuses disabling arguments. No local browser or
tool installation, held helper adoption, mock gateway or production environment.

The job's fresh database/Redis and production cmd/server own canonical migrations
and API wiring. Real RPCs provision A/B, C without city, and existing legacy demo.
SQL coordinate lookup is only a disposable fixture precondition, not a proposed
spawn policy. Fixture registration/city creation is not browser onboarding coverage.
CLIENT owns all real UI actions in client/qa/existingAccount.browser.mjs. Both
1280x720 and 1600x900 must complete all named cases. Wrong password and no city
must fail closed; account/city identity snapshots must remain identical. Login
sessions, last-login timestamps and normal scheduler resource changes are excluded
from that identity snapshot; Login/EnsurePlayer is not described as read-only.

Artifacts retain exact head/tree, complete tracked inventory, tool/binary hashes,
fixture routes, DB snapshots, redacted browser observations and cleared-field
screenshots. No password, session token, raw frame, HAR or Playwright trace is saved.
Failed execution still uploads available diagnostics/hashes, never a PASS result.
Top-level failures emit only a fixed phase label, never arbitrary exception text.
Owned browser, sockets and child processes are closed before acceptance. Pure
negative controls are not live evidence. New exact-head source/composition review,
all applicable CI and final native evidence are required before conditional merge.

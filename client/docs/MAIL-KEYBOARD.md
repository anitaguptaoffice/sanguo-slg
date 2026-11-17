# Mail keyboard access

CLIENT-MAIL-KEYBOARD-001, issue #2306. New CLIENT-only implementation on main
ff73e437047b6ccb94a607b9f006555fb34b2f41. Historical held PRs are not incorporated.

Each loaded message title is a native button. Tab can reach it; native Enter or
Space activation follows the existing click/open/read path. Focusing alone does
not read a message. Attachment selection remains a separate sibling checkbox;
this change never claims attachments or changes mail pagination/cache behavior.

When a mail rerender replaces the currently focused title or checkbox, focus
returns to that same control. If its unread row disappears, the row now at its
old position receives focus (last remaining row at the end). If no rows remain,
the existing unread filter receives focus. Newer unrelated focus is preserved.
No custom keydown-to-click synthesis or global keyboard handler is installed.

## Evidence and remaining gates

Regression-first mounted production baseline: pointer selection and keyboard
inaccessibility witnesses passed; required focusable target failed. Gateway
responses in these tests are doubles, not real-service or native-browser proof.
The focused suite covers native button semantics, explicit click activation,
synchronous/asynchronous focus replacement, checkbox separation, filtered-row
removal, read failure and no automatic claim/read/retry on focus.

Before merge: full client/build, independent exact-source and temporary held
#2004 compatibility review, exact-head CI, and separate official-runner real
server/native keyboard acceptance at 1280x720 and 1600x900. The latter must use
actual Tab/Enter/Space, visible focus/body and real mail readbacks. Unit-dispatched
keyboard events do not demonstrate native button activation. Disposable fixture
mail may use existing gm send-mail, never real players or attachment claims.
Keep the product Draft until all gates pass. No production deployment.

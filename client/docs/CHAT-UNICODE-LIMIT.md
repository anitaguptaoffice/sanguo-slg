# CLIENT-CHAT-UNICODE-LIMIT-001

Task: https://github.com/anitaguptaoffice/sanguo-slg/issues/2284

Chat uses the existing limit of 500 Unicode code points, matching the default
Go rune limit in `internal/chat/service.go`. Astral characters such as 😀 count
as one code point, not two UTF-16 units. This is not a grapheme-cluster limit:
combining marks and multi-code-point emoji sequences count individually.

The production input intentionally has no native `maxlength`, because browsers
measure that attribute in UTF-16 units and silently prevent valid input. Existing
send validation remains authoritative on the client: trim, reject empty content,
reject more than 500 code points, otherwise send unchanged trimmed content.
Over-limit input stays editable and is never truncated. The counter shows the
raw draft count, including whitespace (e.g. `501/500`); send validation retains
its existing trimmed semantics. No backend, protocol or send lifecycle changes.

## Automated checks

`npm test -- src/ui/SocialPanels.chatUnicode.test.ts src/ui/SocialPanels.chatSend.test.ts src/net/chatSendValidation.test.ts`

The new mounted production-panel tests check missing UTF-16 cap, exact payloads
at 500 ASCII/Chinese/astral/mixed code points, rejection at 501 without RPC or
draft loss, truthful counters, empty input, trimming, reopen/remount restoration
and pending sends with a newer draft. On the unchanged main implementation,
8 of 15 new tests fail (native attribute and capped counter assertions).
Run the full client suite and `npm run build` as well.

## Real-browser merge gate

jsdom value assignment does not reproduce native `maxlength` behavior. Therefore
the structural test alone does not prove typing or paste works in a browser.
An official browser must mount the actual production SocialPanels, focus
`[data-center-panel="chat"] [data-field="chat-content"]`, and enter text using
native keyboard/paste input, not direct DOM value assignment:

- 499 ASCII plus one astral emoji, and 500 astral emoji: preserve all input,
  display `500/500`, and send the exact payload once.
- Append one code point: preserve all 501, show `501/500`; Send shows the existing
  length error, makes no Send RPC, and preserves input and session draft.
- Correct and retry; reopen the panel; check an in-flight send cannot erase a
  newer draft. Exercise ASCII, Chinese, empty input and whitespace controls.
- Record exact source SHA/tree and runtime, input method, counter, payload/RPC
  evidence and draft outcome. Validate unchanged-main native failure as control.

Until this gate, independent final-source/composition review and exact-head CI
pass, the new PR stays Draft/HOLD. Temporary composition with held rank PR #2006
is verification only: it neither imports that PR into this fix nor releases its
hold. No historical hold is modified or merged, and no production is deployed.

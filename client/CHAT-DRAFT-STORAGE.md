# CLIENT-CHAT-DRAFT-STORAGE-001

The latest chat draft belongs to its `SocialPanels` instance. Session storage is
read only before the first local draft is known; input edits, guild mentions and
confirmed send clears update memory before best-effort persistence. An empty
string is a known cleared draft, not a reason to restore an older stored value.
Closing/reopening chat or reattaching the same instance therefore retains the
latest text and counter even when `setItem` or `removeItem` fails. Both the main
chat toggle and guild-channel entry restore this same draft. Persistence
is attempted again by existing input/close events, without a background retry.

The existing `guild-chat-draft-v1` key and raw text format remain unchanged.
Send ownership, destination, pending-operation and draft-version guards still
control when a successful send may clear input. No automatic send or resend is
introduced. A failed send retains the draft for an explicit user retry.

This is an in-memory lifetime guarantee, not durable storage: after a full page
reload or construction of a new instance, rejected writes cannot be recovered
and a stale value whose removal failed may still be present. Account scoping
and denied global storage-getter handling are unchanged and outside this fix.

`npm test -- src/ui/SocialPanels.chatDraftStorage.test.ts` exercises real panel
DOM handlers with storage-operation faults and a controlled gateway. It covers
normal restore/write/clear, quota failure, explicit/confirmed empty drafts,
reopening/remounting, pending-send edits, failure/explicit retry, guild mentions,
persistence recovery and edits before first opening. Run the existing chat/send,
read and social suites, full `npm test`, and `npm run build` before delivery.
These are production-module DOM integration tests, not native-browser or live
server acceptance. No layout, style, protocol, backend or deployment changes.

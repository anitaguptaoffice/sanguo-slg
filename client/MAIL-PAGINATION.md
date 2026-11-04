# CLIENT-MAIL-PAGINATION-001

Task: https://github.com/anitaguptaoffice/sanguo-slg/issues/2002

## Player behavior

The inbox initially loads 50 raw server rows. “加载更早邮件” appends the next page until the server total is reached or an empty page is returned. Selection is retained; repeated IDs are updated without duplicate rows. Failed appends retain rows and retry the same offset. Refresh and server-backed tab changes restart at the first page. Local attachment/category filters do not change the raw offset, so an empty filtered page can still offer older mail.

“领取已加载附件” acts only on eligible rows loaded in the current tab. Loading does not claim attachments or mark mail read. Reading/claiming a loaded unread row adjusts the unread offset and invalidates an in-flight page based on the old offset. Newer reads, actor changes, and detached panels reject stale responses. Commands already sent to the server cannot be canceled.

## Dependency and limits

Depends on server task #2001 for deterministic created_at DESC, mail_id DESC ordering. No protocol/server/configuration changes here. Offset paging is not a snapshot: incoming mail or external mutations can shift page boundaries. Refresh resynchronizes the inbox; de-duplication prevents repeated displayed rows but cannot guarantee completeness under concurrent external writes.

## Automated verification

Run `cd client && npm test -- src/ui/HeroMailPanels.pagination.test.ts src/ui/HeroMailPanels.test.ts`, then complete `npm test` and `npm run build`.

Tests drive real HeroMailPanels DOM events in jsdom with a mocked gateway. They cover the inaccessible 51st mail, selection, duplicate rows/clicks, retries, attachment filtering, actor changes, refresh/filter/detach interruptions, empty pages, and unread-offset adjustment. These are client integration tests, not live browser/server end-to-end acceptance.

## Required acceptance before merge

Keep Draft/HOLD until #2001 is independently reviewed and integrated, and the dependency combination is verified. With a real server, seed >100 mails including equal timestamps, unread rows, rewards, and battle reports. Traverse all pages without omissions/duplicates in stable data, read/claim between unread pages, refresh, change tabs, and verify reward/mark-read behavior. At 1280/1600 widths, verify mouse/keyboard access, button visibility/disabled state, scrolling, selected detail, and error retry. Live server and browser checks have NOT been performed in this environment. No deployment is implied.

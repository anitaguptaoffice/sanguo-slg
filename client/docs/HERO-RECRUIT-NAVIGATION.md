# Hero → recruitment navigation

CLIENT-HERO-RECRUIT-NAVIGATION-001, issue #2064. Client-only; no RPC, economic or server rule changes.

The native recruitment disclosure contains the selector, cost preview and submit button. Previously every hero detail render closed it, including the render triggered by “去招募” and template selection. Now the compact default follows hero/list navigation; ordinary rerenders preserve native manual open/close choices. The explicit handoff opens the disclosure only after locating the requested template.

A fresh public hero deep link does not prefetch recruitment templates. Its first handoff can therefore wait for a real template request while the user navigates. Both the template read and subsequent handoff check the same actor, panel, mount and hero-link intent. Newer Back, another hero, bag link, template selection or panel navigation wins. Requests already sent are not canceled or resent. Failure remains an error and can be retried explicitly; absent templates do not report success.

Mounted production-controller tests resolve reads in send order, including templates before the next hero detail. They check native disclosure state, successful selection, failure/retry, lifecycle/actor boundaries and absence of recruitment mutations. They are not browser layout or live server acceptance.

## Browser acceptance HOLD

Keep the PR Draft until real 1280×720 and 1600×900 browser checks establish:
- Hero details begin compact; “去招募” reveals selector, cost and submit controls without unintended recruitment.
- Tab/Enter/Space can reach and operate the native disclosure and template controls; focus and scroll remain usable with long lists.
- Manual open/close survives template changes and refresh; another hero restores the compact layout.
- Cold template reads cannot steal Back/another hero/another panel navigation; retry displays truthful errors.

#2004 mail pagination is a same-file held draft. Validate a temporary combination; do not change its branch or release its hold. No browser startup restriction is bypassed.

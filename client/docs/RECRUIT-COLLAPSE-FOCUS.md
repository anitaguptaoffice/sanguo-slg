# Recruitment automatic-collapse focus

Task: [CLIENT-RECRUIT-COLLAPSE-FOCUS-001 / #2281](https://github.com/anitaguptaoffice/sanguo-slg/issues/2281).
New implementation on main `757e43a9f40d7c92ded6a536ec334de94d69ff6f`.

## Boundary

The existing detail-state decision still automatically closes recruitment.
Immediately before an open host closes, a focused descendant of its body is
moved to that host's direct native summary with `preventScroll: true`.
Focus already on the summary or outside the host is not moved. An already
closed host or a refresh that keeps it open does not initiate a transfer.
No preferences, navigation, request ownership, commands or collapse decisions
change. This is not manual expansion persistence, scroll preservation, a
radio-group focus-trap repair or activation of historical HOLD PR #2065.

## Regression evidence

The mounted production controller loads a hero through the actual list-row
click, receives its detail, and reopens recruitment via summary activation.
The production public `refreshRecruitAffordability()` entry point renders
templates before the hero list. Instrumentation at the existing sync helper
observes the same connected refresh button or select still actively focused,
with recruitment open. It does not invoke the private helper out of order.
Both identity/path controls passed before implementation; both expected
summary-focus assertions failed. JSDOM retained the hidden control as active,
which is not evidence of native Chromium focus behavior.

The populated-template fixture also uses the actual template-refresh button.
Its affordability refresh reaches the helper twice: first through template
selection with the original control active, then through the public method's
second list render with the same summary active and host already closed.
Only the first call transfers focus; both controls retain their DOM identity.

The focused suite covers both controls, transfer before closing, summary and
outside-host/root focus, unchanged-open and already-closed refresh, reopening,
and hidden-panel refresh. It checks no recruit command is issued. Synthetic
DOM tests do not certify layout, native Tab order or real browser focus loss.

## Official evidence and remaining gate

[Official run 42420722051](https://github.com/anitaguptaoffice/sanguo-slg/actions/runs/42420722051)
records focus inside recruitment, a disclosure open-to-closed transition during
screenshot capture, then BODY before the next Tab in both 1600-wide cells.
It did not retain the previous control across the interval or instrument the
collapse call stack. It therefore supports inter-input focus loss but does
not establish setter-time causation. Its product sources predate this fix.

Independent source review, full client tests/build and required exact-head CI
are release gates. Separate registered official real-service Chromium
acceptance at 1280/1600 must verify the final focus transition, ordinary
Tab/Shift+Tab and summary activation. The existing 399-line layout QA is not
expanded or relaxed. Local browser startup was denied and is not retried.
Until the official native gate passes this remains unaccepted for release.
No production deployment or historical hold release is authorized by this fix.

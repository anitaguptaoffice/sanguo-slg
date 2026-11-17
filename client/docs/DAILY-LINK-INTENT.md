# Daily deep-link selection ownership

CLIENT-DAILY-LINK-INTENT-001, issue #2068. Existing client navigation only; no new controls, task rules, RPC, rewards or mutation retry.

A queue/HUD daily link may wait for ListPlayerQuests while the old rows and filters remain interactive. Previously its result forcibly reselected the original task and reset a newer incompatible filter. DATA-002 farm-upgrade quest1032 provides a real QueuePanels → DailyQuestPanels route; selecting Completed and quest1013 during that one pending request proves the issue without reversing RPC responses.

Selection intent now changes on manual row/filter/tab/locate actions and panel suspension. A current successful read still applies authoritative catalog/progress and publishes the HUD snapshot, but superseded focus/pick mode does not reset the newer selection/filter. Unchanged explicit links retain their previous reveal behavior. Background recruitment refresh follows the same rule without altering its mutation or reward flow.

Read continuations receive a live ownership predicate, not merely a past success flag. Superseded, failed or replaced reads cannot scroll for the old link. Temporary badge counts clear when the owned read settles; fresh catalog counts remain authoritative. Old presentation feedback is suppressed after newer intent, while the current list can still display its real error.

Tests mount production daily and queue components and use actual DOM controls with a single pending read/FIFO responses. No browser/layout or live-server acceptance is claimed. The repair has no visual/layout changes; applicable acceptance must be confirmed by independent review before merging.

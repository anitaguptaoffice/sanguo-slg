// Package mail implements player inbox storage and attachment claims (MAIL-001).
//
// Inbox pages sort by created_at descending, then mail_id descending. The unique
// mail ID within a server breaks timestamp ties so offset pages are deterministic
// for an unchanged inbox. This does not provide a snapshot across concurrent
// inserts, deletes, or status changes between page requests.
package mail

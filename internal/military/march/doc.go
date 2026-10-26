// Package march implements recruit queues and field march timing for the military domain.
// Queue phases: pending → marching → arrived → returning → returned.
// Due events are driven by the in-process Scheduler (tick ≤ 1s, firing error < 1s).
// March admission validates positive known troop counts and checked duplicate sums
// before any ready-troop deduction or order/event publication. Valid duplicate
// stacks combine in first-appearance order; valid unique stacks retain their timing.
// This is in-memory input integrity, not durable or cross-domain atomic dispatch.
// SnapshotMarch copies the order and current runtime troops under one lock,
// including recorded battle survivors retained as history after return settlement.
// Returned is published only after crediting survivors to an existing origin city;
// missing runtime/city or repeated events cannot publish completion or recredit.
// Survivor units/counts and all affected ready balances are checked before credit;
// malformed/overflowing settlement stays returning without partial credit or a
// finished callback. No new retry/recovery subsystem is provided.
// Pending is not a completion sentinel. Zero-survivor and no-battle arrivals remain
// arrived. Completion retains the existing finished callback/hero-release flow;
// returned does not guarantee durable settlement or atomic hero-idle status.
package march

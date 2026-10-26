// Package march implements recruit queues and field march timing for the military domain.
// Queue phases: pending → marching → arrived → returning.
// Due events are driven by the in-process Scheduler (tick ≤ 1s, firing error < 1s).
// March admission validates positive known troop counts and checked duplicate sums
// before any ready-troop deduction or order/event publication. Valid duplicate
// stacks combine in first-appearance order; valid unique stacks retain their timing.
// This is in-memory input integrity, not durable or cross-domain atomic dispatch.
// SnapshotMarch copies the order and current runtime troops under one lock,
// including recorded battle survivors without changing lifecycle semantics.
package march

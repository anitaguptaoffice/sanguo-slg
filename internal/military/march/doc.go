// Package march implements recruit queues and field march timing for the military domain.
// Queue phases: pending → marching → arrived → returning.
// Due events are driven by the in-process Scheduler (tick ≤ 1s, firing error < 1s).
package march

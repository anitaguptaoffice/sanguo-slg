package march

import "time"

// MarchPhase is the march order state machine (MIL-002).
type MarchPhase string

const (
	PhasePending   MarchPhase = "pending"
	PhaseMarching  MarchPhase = "marching"
	PhaseArrived   MarchPhase = "arrived"
	PhaseReturning MarchPhase = "returning"
)

// QueueStatus mirrors work_queue.status for recruit jobs.
type QueueStatus int8

const (
	QueueWaiting   QueueStatus = 0
	QueueActive    QueueStatus = 1
	QueueDone      QueueStatus = 2
	QueueCancelled QueueStatus = 3
)

// Resources are the four build resources (no gold for recruit cost in M1).
type Resources struct {
	Food  int64
	Wood  int64
	Iron  int64
	Stone int64
}

// Add returns a + b per field.
func (a Resources) Add(b Resources) Resources {
	return Resources{
		Food:  a.Food + b.Food,
		Wood:  a.Wood + b.Wood,
		Iron:  a.Iron + b.Iron,
		Stone: a.Stone + b.Stone,
	}
}

// Sub mutates a by subtracting b; returns false if any field would go negative.
func (a *Resources) Sub(b Resources) bool {
	if a.Food < b.Food || a.Wood < b.Wood || a.Iron < b.Iron || a.Stone < b.Stone {
		return false
	}
	a.Food -= b.Food
	a.Wood -= b.Wood
	a.Iron -= b.Iron
	a.Stone -= b.Stone
	return true
}

// Scale multiplies all fields by n (for per-unit costs).
func (r Resources) Scale(n int32) Resources {
	if n <= 0 {
		return Resources{}
	}
	return Resources{
		Food:  r.Food * int64(n),
		Wood:  r.Wood * int64(n),
		Iron:  r.Iron * int64(n),
		Stone: r.Stone * int64(n),
	}
}

// RecruitJob is one recruit queue entry for a city.
type RecruitJob struct {
	ID        int64
	UnitCfgID int32
	Count     int32
	CostPaid  Resources
	Status    QueueStatus
	StartAt   time.Time
	FinishAt  time.Time
}

// MarchOrder tracks one army movement through pending → marching → arrived → returning.
type MarchOrder struct {
	ID      int64
	ArmyID  int64
	FromX   int
	FromY   int
	ToX     int
	ToY     int
	Purpose int16
	Phase   MarchPhase
	// Effective march speed (slowest unit in the stack), from cfg_unit.stats.speed.
	Speed int

	DepartAt       time.Time
	ArriveAt       time.Time
	ReturnFinishAt time.Time
}

// CityState is the in-memory slice used by Hub (persisted copies live in domestic/military tables).
type CityState struct {
	ID       int64
	PlayerID int64
	Wallet   Resources
	Troops   map[int32]int32 // unit_cfg_id → count

	RecruitJobs []*RecruitJob
	nextJobID   int64
}

// TroopStack is a unit type count used when starting a march.
type TroopStack struct {
	UnitCfgID int32
	Count     int32
}

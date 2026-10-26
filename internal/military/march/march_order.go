package march

import (
	"errors"
	"time"
)

var (
	ErrInvalidMarch     = errors.New("march: invalid march order")
	ErrMarchNotFound    = errors.New("march: order not found")
	ErrInvalidPhase     = errors.New("march: invalid phase transition")
	ErrNoTroopsToMarch     = errors.New("march: empty troop stack")
	ErrInsufficientTroops = errors.New("march: insufficient city troops")
)

// StartMarchRequest creates a pending march that departs immediately when committed via Hub.
type StartMarchRequest struct {
	ArmyID       int64
	OriginCityID int64
	PlayerID     int64
	HeroID       int64
	FromX        int
	FromY        int
	ToX          int
	ToY          int
	Purpose      int16
	Troops       []TroopStack
}

// BeginMarch transitions pending → marching and returns the order with timing filled in.
func BeginMarch(
	catalog map[int32]UnitSpec,
	now time.Time,
	req StartMarchRequest,
) (*MarchOrder, error) {
	troops, err := NormalizeMarchTroops(catalog, req.Troops)
	if err != nil {
		return nil, err
	}
	dist := GridDistance(req.FromX, req.FromY, req.ToX, req.ToY)
	speed := EffectiveMarchSpeed(catalog, troops)
	sec := MarchDurationSec(dist, speed)
	depart := now
	arrive := depart.Add(time.Duration(sec) * time.Second)
	return &MarchOrder{
		ArmyID:   req.ArmyID,
		FromX:    req.FromX,
		FromY:    req.FromY,
		ToX:      req.ToX,
		ToY:      req.ToY,
		Purpose:  req.Purpose,
		Phase:    PhaseMarching,
		Speed:    speed,
		DepartAt: depart,
		ArriveAt: arrive,
	}, nil
}

// MarkArrived transitions marching → arrived.
func MarkArrived(o *MarchOrder) error {
	if o.Phase != PhaseMarching {
		return ErrInvalidPhase
	}
	o.Phase = PhaseArrived
	return nil
}

// BeginReturn transitions arrived → returning and sets return ETA (same distance/speed).
func BeginReturn(o *MarchOrder, now time.Time) error {
	if o.Phase != PhaseArrived {
		return ErrInvalidPhase
	}
	dist := GridDistance(o.FromX, o.FromY, o.ToX, o.ToY)
	sec := MarchDurationSec(dist, o.Speed)
	o.Phase = PhaseReturning
	o.ReturnFinishAt = now.Add(time.Duration(sec) * time.Second)
	return nil
}

// MarkReturnComplete clears returning phase (army back at origin).
func MarkReturnComplete(o *MarchOrder) error {
	if o.Phase != PhaseReturning {
		return ErrInvalidPhase
	}
	o.Phase = PhasePending
	o.ReturnFinishAt = time.Time{}
	return nil
}

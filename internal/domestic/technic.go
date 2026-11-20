package domestic

import (
	"context"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"
)

//go:embed seed/technic_catalog.json
var technicSeed embed.FS

// TechnicPrereq is one cross-technic requirement.
type TechnicPrereq struct {
	TID   int32
	Level int32
}

// TechnicLevel is one explicit research level.
type TechnicLevel struct {
	Level   int32
	Cost    Resources
	TimeSec int64
	Bonus   map[string]int64
}

// TechnicDef is one academy research entry.
type TechnicDef struct {
	TID          int32
	Code         string
	Name         string
	Category     string
	AcademyLevel int32
	MaxLevel     int32
	Prereqs      []TechnicPrereq
	Levels       []TechnicLevel
}

// ResearchJob is one in-flight academy research (single queue).
type ResearchJob struct {
	ID       int64
	TID      int32
	Target   int32
	Status   QueueStatus
	FinishAt time.Time
}

var (
	technicOnce sync.Once
	technicTree map[int32]TechnicDef
	technicErr  error
)

// DefaultTechnicTree returns the embedded 28-technic catalog.
func DefaultTechnicTree() map[int32]TechnicDef {
	technicOnce.Do(func() {
		raw, err := technicSeed.ReadFile("seed/technic_catalog.json")
		if err != nil {
			technicErr = err
			return
		}
		technicTree, technicErr = loadTechnicTree(raw)
	})
	if technicErr != nil {
		panic(technicErr)
	}
	return technicTree
}

func loadTechnicTree(raw []byte) (map[int32]TechnicDef, error) {
	var doc struct {
		Version  int `json:"version"`
		Technics []struct {
			TID          int32  `json:"tid"`
			Code         string `json:"code"`
			Name         string `json:"name"`
			Category     string `json:"category"`
			AcademyLevel int32  `json:"academy_level"`
			MaxLevel     int32  `json:"max_level"`
			Prereqs      []struct {
				TID   int32 `json:"tid"`
				Level int32 `json:"level"`
			} `json:"prereqs"`
			Levels []struct {
				Level int32 `json:"level"`
				Cost  struct {
					Food, Wood, Stone, Iron int64
				} `json:"cost"`
				TimeSec int64            `json:"time_sec"`
				Bonus   map[string]int64 `json:"bonus"`
			} `json:"levels"`
		} `json:"technics"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil, fmt.Errorf("domestic: parse technic catalog: %w", err)
	}
	if doc.Version != 1 {
		return nil, fmt.Errorf("domestic: unsupported technic catalog version %d", doc.Version)
	}
	out := make(map[int32]TechnicDef, len(doc.Technics))
	for _, t := range doc.Technics {
		if t.TID <= 0 || t.MaxLevel <= 0 || len(t.Levels) != int(t.MaxLevel) {
			return nil, fmt.Errorf("domestic: invalid technic %+v", t)
		}
		def := TechnicDef{TID: t.TID, Code: t.Code, Name: t.Name, Category: t.Category,
			AcademyLevel: t.AcademyLevel, MaxLevel: t.MaxLevel}
		for _, p := range t.Prereqs {
			def.Prereqs = append(def.Prereqs, TechnicPrereq{TID: p.TID, Level: p.Level})
		}
		for i, row := range t.Levels {
			if row.Level != int32(i+1) {
				return nil, fmt.Errorf("domestic: technic %d level order", t.TID)
			}
			level := TechnicLevel{Level: row.Level, TimeSec: row.TimeSec,
				Cost:  Resources{Food: row.Cost.Food, Wood: row.Cost.Wood, Stone: row.Cost.Stone, Iron: row.Cost.Iron},
				Bonus: row.Bonus}
			def.Levels = append(def.Levels, level)
		}
		out[def.TID] = def
	}
	if len(out) != 28 {
		return nil, fmt.Errorf("domestic: expected 28 technics, got %d", len(out))
	}
	return out, nil
}

// TechnicLevelOf returns the player's shared level for a technic.
func TechnicLevelOf(c *CityState, tid int32) int32 {
	if c == nil || c.Research == nil {
		return 0
	}
	return c.Research[tid]
}

// TechnicBonus sums the player's global bonus for one key.
func TechnicBonus(c *CityState, key string) int64 {
	if c == nil {
		return 0
	}
	var total int64
	for tid, level := range c.Research {
		def, ok := DefaultTechnicTree()[tid]
		if !ok || level <= 0 {
			continue
		}
		if int(level) > len(def.Levels) {
			level = int32(len(def.Levels))
		}
		total += def.Levels[level-1].Bonus[key]
	}
	return total
}

func technicPrereqMet(c *CityState, def TechnicDef, target int32) (bool, string) {
	for _, req := range def.Prereqs {
		if TechnicLevelOf(c, req.TID) < req.Level {
			return false, "前置科技未满足"
		}
	}
	return true, ""
}

// TechnicAvailable reports whether the city can start the next level.
func TechnicAvailable(c *CityState, def TechnicDef) (bool, string) {
	level := TechnicLevelOf(c, def.TID)
	if level >= def.MaxLevel {
		return false, "已研究至满级"
	}
	if buildingLevel(c, 8) < def.AcademyLevel {
		return false, fmt.Sprintf("需要书院 Lv%d", def.AcademyLevel)
	}
	if ok, reason := technicPrereqMet(c, def, level+1); !ok {
		return false, reason
	}
	return true, ""
}

// ResearchResult reports the queued academy job.
type ResearchResult struct {
	TID      int32
	Target   int32
	FinishAt time.Time
	Wallet   Resources
}

// StartTechnicResearch queues the next level of one technic.
func (h *Hub) StartTechnicResearch(ctx context.Context, cityID int64, tid int32) (ResearchResult, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	var res ResearchResult
	err := h.updateCityLocked(ctx, cityID, func(c *CityState) error {
		def, ok := DefaultTechnicTree()[tid]
		if !ok {
			return ErrUnknownTechnic
		}
		if c.ResearchJob != nil && (c.ResearchJob.Status == QueueWaiting || c.ResearchJob.Status == QueueActive) {
			return ErrResearchBusy
		}
		if ok, reason := TechnicAvailable(c, def); !ok {
			return fmt.Errorf("%w: %s", ErrTechnicPrereq, reason)
		}
		target := TechnicLevelOf(c, tid) + 1
		row := def.Levels[target-1]
		if !c.Wallet.Sub(row.Cost) {
			return ErrInsufficientRes
		}
		dur := time.Duration(row.TimeSec) * time.Second
		if pct := TechnicBonus(c, "research_speed_pct"); pct > 0 {
			dur = dur * time.Duration(100-pct) / 100
			if dur < time.Second {
				dur = time.Second
			}
		}
		c.nextJobID++
		job := &ResearchJob{ID: c.nextJobID, TID: tid, Target: target, Status: QueueActive, FinishAt: h.now().Add(dur)}
		c.ResearchJob = job
		res = ResearchResult{TID: tid, Target: target, FinishAt: job.FinishAt, Wallet: c.Wallet}
		return nil
	})
	if err != nil {
		return ResearchResult{}, err
	}
	if res.FinishAt.IsZero() {
		return ResearchResult{}, ErrResearchBusy
	}
	h.sched.add(res.FinishAt, func() { h.onResearchDone(cityID, res.TID) })
	return res, nil
}

func (h *Hub) onResearchDone(cityID int64, tid int32) {
	h.mu.Lock()
	defer h.mu.Unlock()
	var target int32
	err := h.updateCityLocked(context.Background(), cityID, func(c *CityState) error {
		job := c.ResearchJob
		if job == nil || job.TID != tid {
			return ErrJobNotFound
		}
		if h.now().Before(job.FinishAt) {
			return ErrInvalidUpgrade
		}
		target = job.Target
		if c.Research == nil {
			c.Research = make(map[int32]int32)
		}
		c.Research[tid] = target
		c.ResearchJob = nil
		return nil
	})
	if err != nil {
		if !errors.Is(err, ErrCityNotFound) && !errors.Is(err, ErrJobNotFound) {
			h.sched.add(h.now().Add(time.Second), func() { h.onResearchDone(cityID, tid) })
		}
		return
	}
	// Player-global sharing: every loaded city of this player sees the level.
	if city := h.cities[cityID]; city != nil {
		for id, other := range h.cities {
			if id == cityID || other.PlayerID != city.PlayerID {
				continue
			}
			if other.Research == nil {
				other.Research = make(map[int32]int32)
			}
			other.Research[tid] = target
		}
	}
}

// ActiveResearch returns the current job if any.
func (c *CityState) ActiveResearch() *ResearchJob {
	if c == nil {
		return nil
	}
	return c.ResearchJob
}

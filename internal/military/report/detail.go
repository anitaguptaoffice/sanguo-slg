package report

import (
	"encoding/json"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/battle"
)

func encodeDetail(rep battle.BattleReport) ([]byte, error) {
	return json.Marshal(rep)
}

func decodeDetail(raw []byte) (battle.BattleReport, error) {
	var rep battle.BattleReport
	if err := json.Unmarshal(raw, &rep); err != nil {
		return battle.BattleReport{}, err
	}
	return rep, nil
}

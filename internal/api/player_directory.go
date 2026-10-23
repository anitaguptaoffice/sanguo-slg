package api

import (
	"context"

)

// DisplayName implements chat/guild PlayerDirectory.
func (s *PlayerStore) DisplayName(ctx context.Context, serverID int32, playerID int64) (string, error) {
	var name string
	err := s.Pool.QueryRow(ctx, `
		SELECT display_name FROM player WHERE server_id = $1 AND player_id = $2`,
		serverID, playerID).Scan(&name)
	if err != nil {
		if isNoRows(err) {
			return "", err
		}
		return "", err
	}
	return name, nil
}

// ExistsOnServer implements chat PlayerDirectory.
func (s *PlayerStore) ExistsOnServer(ctx context.Context, serverID int32, playerID int64) (bool, error) {
	var one int
	err := s.Pool.QueryRow(ctx, `
		SELECT 1 FROM player WHERE server_id = $1 AND player_id = $2`,
		serverID, playerID).Scan(&one)
	if err != nil {
		if isNoRows(err) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// PlayerPower implements guild PlayerDirectory.
func (s *PlayerStore) PlayerPower(ctx context.Context, serverID int32, playerID int64) (int64, error) {
	var power int64
	err := s.Pool.QueryRow(ctx, `
		SELECT power FROM player WHERE server_id = $1 AND player_id = $2`,
		serverID, playerID).Scan(&power)
	if err != nil {
		return 0, err
	}
	return power, nil
}

package api

import (
	"context"
	"fmt"
	"strings"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/jackc/pgx/v5/pgxpool"
)

type gmPlayerRow struct {
	AccountID    int64
	LoginName    string
	AccountBan   bool
	ServerID     int32
	PlayerID     int64
	DisplayName  string
	Level        int32
	Power        int64
	Wallet       content.ResourceWallet
}

func lookupPlayerRow(ctx context.Context, pool *pgxpool.Pool, serverID int32, playerID int64, login string) (gmPlayerRow, error) {
	login = strings.TrimSpace(login)
	var row gmPlayerRow
	var status int16
	if playerID > 0 {
		err := pool.QueryRow(ctx, `
			SELECT p.account_id, a.login_name, a.status, p.server_id, p.player_id,
			       p.display_name, p.level, p.power,
			       COALESCE(w.food,0), COALESCE(w.wood,0), COALESCE(w.iron,0), COALESCE(w.stone,0), COALESCE(w.gold,0)
			FROM player p
			JOIN account a ON a.account_id = p.account_id
			LEFT JOIN player_wallet w ON w.server_id = p.server_id AND w.player_id = p.player_id
			WHERE p.server_id = $1 AND p.player_id = $2`,
			serverID, playerID,
		).Scan(&row.AccountID, &row.LoginName, &status, &row.ServerID, &row.PlayerID,
			&row.DisplayName, &row.Level, &row.Power,
			&row.Wallet.Food, &row.Wallet.Wood, &row.Wallet.Iron, &row.Wallet.Stone, &row.Wallet.Gold)
		if err != nil {
			return gmPlayerRow{}, err
		}
	} else if login != "" {
		err := pool.QueryRow(ctx, `
			SELECT p.account_id, a.login_name, a.status, p.server_id, p.player_id,
			       p.display_name, p.level, p.power,
			       COALESCE(w.food,0), COALESCE(w.wood,0), COALESCE(w.iron,0), COALESCE(w.stone,0), COALESCE(w.gold,0)
			FROM account a
			JOIN player p ON p.account_id = a.account_id AND p.server_id = $1
			LEFT JOIN player_wallet w ON w.server_id = p.server_id AND w.player_id = p.player_id
			WHERE a.login_name = $2`,
			serverID, login,
		).Scan(&row.AccountID, &row.LoginName, &status, &row.ServerID, &row.PlayerID,
			&row.DisplayName, &row.Level, &row.Power,
			&row.Wallet.Food, &row.Wallet.Wood, &row.Wallet.Iron, &row.Wallet.Stone, &row.Wallet.Gold)
		if err != nil {
			return gmPlayerRow{}, err
		}
	} else {
		return gmPlayerRow{}, fmt.Errorf("gm: player_id or account_login required")
	}
	if login != "" && row.LoginName != login {
		return gmPlayerRow{}, fmt.Errorf("gm: account_login does not match player")
	}
	row.AccountBan = status == 2
	return row, nil
}

func revokeAccountSessions(ctx context.Context, pool *pgxpool.Pool, accountID int64) (int64, error) {
	tag, err := pool.Exec(ctx, `
		UPDATE account_session SET expires_at = now() - interval '1 second'
		WHERE account_id = $1 AND expires_at > now()`, accountID)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

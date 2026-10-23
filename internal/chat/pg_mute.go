package chat

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// chatPlayerMuteDDL extends SPEC-005 m3_003_chat until contract adds chat_player_mute.
const chatPlayerMuteDDL = `
CREATE TABLE IF NOT EXISTS chat_player_mute (
    server_id    INT          NOT NULL,
    player_id    BIGINT       NOT NULL,
    muted_until  TIMESTAMPTZ  NOT NULL,
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (server_id, player_id)
);
COMMENT ON TABLE chat_player_mute IS '玩家聊天禁言截止；GM 写入，发送路径读取';
`

func (p *PGStore) ensureMuteTable(ctx context.Context) error {
	_, err := p.Pool.Exec(ctx, chatPlayerMuteDDL)
	return err
}

func (p *PGStore) SetMutedUntilMS(ctx context.Context, serverID int32, playerID int64, untilMS int64) error {
	if err := p.ensureMuteTable(ctx); err != nil {
		return err
	}
	if untilMS <= 0 {
		_, err := p.Pool.Exec(ctx, `
			DELETE FROM chat_player_mute WHERE server_id = $1 AND player_id = $2`,
			serverID, playerID,
		)
		return err
	}
	until := time.UnixMilli(untilMS).UTC()
	_, err := p.Pool.Exec(ctx, `
		INSERT INTO chat_player_mute (server_id, player_id, muted_until, updated_at)
		VALUES ($1, $2, $3, now())
		ON CONFLICT (server_id, player_id) DO UPDATE
		SET muted_until = EXCLUDED.muted_until, updated_at = now()`,
		serverID, playerID, until,
	)
	return err
}

func (p *PGStore) MutedUntilMS(ctx context.Context, serverID int32, playerID int64) (int64, error) {
	if err := p.ensureMuteTable(ctx); err != nil {
		return 0, err
	}
	var until time.Time
	err := p.Pool.QueryRow(ctx, `
		SELECT muted_until FROM chat_player_mute
		WHERE server_id = $1 AND player_id = $2`,
		serverID, playerID,
	).Scan(&until)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	return until.UnixMilli(), nil
}

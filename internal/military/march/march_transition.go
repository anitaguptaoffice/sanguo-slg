package march

import (
	"context"
	"errors"
	"slices"
	"strings"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/report"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

var (
	ErrMarchTransition = errors.New("march: invalid arrival transition")
	ErrArrivalReplayed = errors.New("march: arrival already transitioned")
	ErrArrivalMissing  = errors.New("march: durable march order not found")
	errArrivalRow      = errors.New("march: arrival write affected an unexpected row count")
)

// ArrivalCommit is the durable arrival outcome. Report is nil for a no-battle
// arrival, whose survivors must equal the locked army_troop rows.
type ArrivalCommit struct {
	ServerID        int32
	MarchID, ArmyID int64
	ToX, ToY        int32
	Survivors       []TroopStack
	ReturnAt        time.Time
	Report          *report.SaveParams
}

// ArrivalCommitted is the committed status and allocated report identity.
type ArrivalCommitted struct {
	ReportID int64
	Status   int16
	ArmyID   int64
}

// MarchTransition writes the report, march status/deadline, survivor stacks and
// field-army position in the caller-owned transaction, never touching city_troop.
type MarchTransition struct {
	reports *report.Service
	profile freshsource.Profile
}

func NewMarchTransition(reports *report.Service, p freshsource.Profile) (*MarchTransition, error) {
	p, err := freshsource.Snapshot(p)
	if err != nil || reports == nil || strings.HasPrefix(p.SchemaName, "pg_") || p.SchemaName == "information_schema" {
		return nil, ErrMarchTransition
	}
	return &MarchTransition{reports: reports, profile: p}, nil
}

func validateArrivalCommit(serverID int32, in *ArrivalCommit) error {
	if in == nil || in.ServerID != serverID || in.MarchID <= 0 || in.ArmyID <= 0 ||
		in.Report != nil && (in.Report.ReportID != 0 || in.Report.ServerID != in.ServerID || in.Report.AttackerPlayerID <= 0) {
		return ErrMarchTransition
	}
	units := make(map[int32]bool, len(in.Survivors))
	for _, st := range in.Survivors {
		if st.UnitCfgID <= 0 || st.Count <= 0 || units[st.UnitCfgID] {
			return ErrMarchTransition
		}
		units[st.UnitCfgID] = true
	}
	if len(in.Survivors) > 0 && !validMarchTime(in.ReturnAt) {
		return ErrMarchTransition
	}
	return nil
}

// Commit transitions one status-1 order. The order row is locked before the
// report sequence is audited and allocated. Every write runs in a savepoint:
// any returned error rolls it back (SQL errors abort the transaction first),
// so a caller that ignores the error and commits persists no transition write.
// Cleanup ignores caller cancellation; if it cannot be confirmed, the
// connection is closed so no partial state can be committed. Sequence
// allocation is not transactional and may advance on failure, even when every
// row is rolled back; only rows are guaranteed unchanged.
func (t *MarchTransition) Commit(ctx context.Context, tx pgx.Tx, in ArrivalCommit) (out ArrivalCommitted, err error) {
	if t == nil || tx == nil || ctx == nil || (in.Report != nil && t.reports == nil) {
		return out, ErrMarchTransition
	}
	if err = validateArrivalCommit(t.profile.ServerID, &in); err != nil {
		return out, err
	}
	table := func(name string) string { return pgx.Identifier{t.profile.SchemaName, name}.Sanitize() }
	var current int16
	err = tx.QueryRow(ctx, `SELECT status FROM `+table("march_order")+` WHERE server_id=$1 AND march_id=$2 AND army_id=$3 FOR UPDATE`,
		in.ServerID, in.MarchID, in.ArmyID).Scan(&current)
	if errors.Is(err, pgx.ErrNoRows) {
		return out, ErrArrivalMissing
	}
	if err != nil {
		return out, errors.Join(ErrMarchTransition, err)
	}
	switch current {
	case 3, 4:
		return out, ErrArrivalReplayed
	case 1:
	default:
		return out, ErrMarchTransition
	}
	survivors := in.Survivors
	if in.Report == nil {
		locked, err := readStacks(ctx, tx, table, in.ServerID, in.ArmyID, true)
		if err != nil {
			return out, err
		}
		if len(locked) == 0 {
			return out, errors.Join(ErrMarchTransition, errors.New("march: no locked expedition troops"))
		}
		if !sameStacks(locked, in.Survivors) {
			return out, ErrMarchTransition
		}
		survivors = locked
	}
	status, returnAt := int16(3), any(in.ReturnAt)
	if len(survivors) == 0 {
		status, returnAt = 4, nil
	}
	active := false
	defer func() {
		if !active {
			return
		}
		active = false
		cctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancel()
		if _, e := tx.Exec(cctx, `ROLLBACK TO SAVEPOINT march_arrival`); e != nil {
			err = errors.Join(err, e)
			_ = tx.Conn().Close(cctx)
		} else if _, e = tx.Exec(cctx, `RELEASE SAVEPOINT march_arrival`); e != nil {
			err = errors.Join(err, e)
			_ = tx.Conn().Close(cctx)
		} else if ctx.Err() != nil {
			_ = tx.Conn().Close(cctx)
		}
	}()
	if _, err = tx.Exec(ctx, `SAVEPOINT march_arrival`); err != nil {
		return out, errors.Join(ErrMarchTransition, err)
	}
	active = true
	var reportID int64
	if in.Report != nil {
		if reportID, err = t.nextReportID(ctx, tx, table); err != nil {
			return out, err
		}
	}
	if err = oneRow(tx.Exec(ctx, `UPDATE `+table("march_order")+` SET status=$4,return_finish_at=$5 WHERE server_id=$1 AND march_id=$2 AND army_id=$3 AND status=1`,
		in.ServerID, in.MarchID, in.ArmyID, status, returnAt)); err != nil {
		return out, errors.Join(ErrMarchTransition, err)
	}
	if _, err = tx.Exec(ctx, `DELETE FROM `+table("army_troop")+` WHERE server_id=$1 AND army_id=$2`, in.ServerID, in.ArmyID); err != nil {
		return out, errors.Join(ErrMarchTransition, err)
	}
	for _, st := range survivors {
		if err = oneRow(tx.Exec(ctx, `INSERT INTO `+table("army_troop")+`(server_id,army_id,unit_cfg_id,count) VALUES($1,$2,$3,$4)`,
			in.ServerID, in.ArmyID, st.UnitCfgID, st.Count)); err != nil {
			return out, errors.Join(ErrMarchTransition, err)
		}
	}
	persisted, err := readStacks(ctx, tx, table, in.ServerID, in.ArmyID, false)
	if err != nil {
		return out, err
	}
	if !sameStacks(persisted, survivors) {
		return out, ErrMarchTransition
	}
	armyStatus := int16(2)
	if status == 4 {
		armyStatus = 1
	}
	if err = oneRow(tx.Exec(ctx, `UPDATE `+table("field_army")+` SET x=$3,y=$4,status=$5,updated_at=pg_catalog.now() WHERE server_id=$1 AND army_id=$2`,
		in.ServerID, in.ArmyID, in.ToX, in.ToY, armyStatus)); err != nil {
		return out, errors.Join(ErrMarchTransition, err)
	}
	if in.Report != nil {
		p := *in.Report
		p.ReportID = reportID
		rec, err := t.reports.SaveTx(ctx, tx, t.profile.SchemaName, p)
		if err != nil {
			return out, errors.Join(ErrMarchTransition, err)
		}
		out.ReportID = rec.ReportID
	}
	if _, err = tx.Exec(ctx, `RELEASE SAVEPOINT march_arrival`); err != nil {
		active = false
		cctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancel()
		_ = tx.Conn().Close(cctx)
		return out, errors.Join(ErrMarchTransition, err)
	}
	active = false
	out.Status, out.ArmyID = status, in.ArmyID
	return out, nil
}

func oneRow(tag pgconn.CommandTag, err error) error {
	if err == nil && tag.RowsAffected() != 1 {
		return errArrivalRow
	}
	return err
}

func readStacks(ctx context.Context, tx pgx.Tx, table func(string) string, serverID int32, armyID int64, lock bool) ([]TroopStack, error) {
	query := `SELECT unit_cfg_id,count FROM ` + table("army_troop") + ` WHERE server_id=$1 AND army_id=$2 ORDER BY unit_cfg_id`
	if lock {
		query += ` FOR UPDATE`
	}
	rows, err := tx.Query(ctx, query, serverID, armyID)
	if err != nil {
		return nil, errors.Join(ErrMarchTransition, err)
	}
	stacks, err := pgx.CollectRows(rows, pgx.RowToStructByPos[TroopStack])
	if err != nil {
		return nil, errors.Join(ErrMarchTransition, err)
	}
	return stacks, nil
}

func sameStacks(locked, in []TroopStack) bool {
	if len(locked) != len(in) {
		return false
	}
	for _, st := range locked {
		if !slices.Contains(in, st) {
			return false
		}
	}
	return true
}

func (t *MarchTransition) nextReportID(ctx context.Context, tx pgx.Tx, table func(string) string) (int64, error) {
	var last, persisted int64
	var called bool
	query := `SELECT last_value,is_called,COALESCE((SELECT pg_catalog.max(report_id) FROM ` + table("battle_report") + `),0) FROM ` + table("battle_report_report_id_seq")
	if err := tx.QueryRow(ctx, query).Scan(&last, &called, &persisted); err != nil {
		return 0, errors.Join(ErrMarchSequence, err)
	}
	if !marchSequenceOK(last, called, persisted) {
		return 0, ErrMarchSequence
	}
	var id int64
	if err := tx.QueryRow(ctx, `SELECT pg_catalog.nextval($1::pg_catalog.regclass)`, table("battle_report_report_id_seq")).Scan(&id); err != nil {
		return 0, errors.Join(ErrMarchSequence, err)
	}
	if id < 1 || id > marchIDCeiling {
		return 0, ErrMarchSequence
	}
	return id, nil
}

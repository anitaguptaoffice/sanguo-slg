package march

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/report"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrMarchTransition = errors.New("march: invalid arrival transition")
	ErrArrivalReplayed = errors.New("march: arrival already transitioned")
	ErrArrivalMissing  = errors.New("march: durable march order not found")
)

// ArrivalCommit is the durable arrival outcome. Report is nil for a no-battle
// arrival; the transition allocates its ID from battle_report_report_id_seq.
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
	ReportID  int64
	Status    int16
	ArmyID    int64
	Survivors []TroopStack
}

// MarchTransition writes the report, march status/deadline, survivor stacks and
// field-army position in one transaction. It touches no city_troop row and
// never begins a transaction for an already-transitioned order.
type MarchTransition struct {
	pool    *pgxpool.Pool
	reports *report.Service
}

func NewMarchTransition(pool *pgxpool.Pool, reports *report.Service) *MarchTransition {
	return &MarchTransition{pool: pool, reports: reports}
}

func validateArrivalCommit(in *ArrivalCommit) error {
	if in == nil || in.ServerID <= 0 || in.MarchID <= 0 || in.ArmyID <= 0 {
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
	if p := in.Report; p != nil && (p.ReportID != 0 || p.ServerID != in.ServerID || p.AttackerPlayerID <= 0) {
		return ErrMarchTransition
	}
	return nil
}

// Commit transitions one status-1 order. A guarded update runs first, so a
// replay fails before the report sequence is touched.
func (t *MarchTransition) Commit(ctx context.Context, in ArrivalCommit) (ArrivalCommitted, error) {
	var out ArrivalCommitted
	if t == nil || t.pool == nil || ctx == nil || (in.Report != nil && t.reports == nil) {
		return out, ErrMarchTransition
	}
	if err := validateArrivalCommit(&in); err != nil {
		return out, err
	}
	tx, err := t.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return out, errors.Join(ErrMarchTransition, err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	var schema string
	if err = tx.QueryRow(ctx, `SELECT pg_catalog.current_schema()`).Scan(&schema); err != nil {
		return out, errors.Join(ErrMarchTransition, err)
	}
	if schema == "" || schema == "information_schema" || strings.HasPrefix(schema, "pg_") {
		return out, ErrMarchTransition
	}
	table := func(name string) string { return pgx.Identifier{schema, name}.Sanitize() }
	status, returnAt := int16(3), any(in.ReturnAt)
	if len(in.Survivors) == 0 {
		status, returnAt = 4, nil
	}
	var armyID int64
	err = tx.QueryRow(ctx, `UPDATE `+table("march_order")+` SET status=$4,return_finish_at=$5 WHERE server_id=$1 AND march_id=$2 AND army_id=$3 AND status=1 RETURNING army_id`,
		in.ServerID, in.MarchID, in.ArmyID, status, returnAt).Scan(&armyID)
	if errors.Is(err, pgx.ErrNoRows) {
		var current int16
		if e := tx.QueryRow(ctx, `SELECT status FROM `+table("march_order")+` WHERE server_id=$1 AND march_id=$2 AND army_id=$3`, in.ServerID, in.MarchID, in.ArmyID).Scan(&current); e == nil && (current == 3 || current == 4) {
			return out, ErrArrivalReplayed
		}
		return out, ErrArrivalMissing
	}
	if err != nil {
		return out, errors.Join(ErrMarchTransition, err)
	}
	if armyID != in.ArmyID {
		return out, ErrMarchTransition
	}
	if _, err = tx.Exec(ctx, `DELETE FROM `+table("army_troop")+` WHERE server_id=$1 AND army_id=$2`, in.ServerID, in.ArmyID); err != nil {
		return out, errors.Join(ErrMarchTransition, err)
	}
	for _, st := range in.Survivors {
		if _, err = tx.Exec(ctx, `INSERT INTO `+table("army_troop")+`(server_id,army_id,unit_cfg_id,count) VALUES($1,$2,$3,$4)`,
			in.ServerID, in.ArmyID, st.UnitCfgID, st.Count); err != nil {
			return out, errors.Join(ErrMarchTransition, err)
		}
	}
	armyStatus := int16(2)
	if len(in.Survivors) == 0 {
		armyStatus = 1
	}
	tag, err := tx.Exec(ctx, `UPDATE `+table("field_army")+` SET x=$3,y=$4,status=$5,updated_at=pg_catalog.now() WHERE server_id=$1 AND army_id=$2`,
		in.ServerID, in.ArmyID, in.ToX, in.ToY, armyStatus)
	if err != nil {
		return out, errors.Join(ErrMarchTransition, err)
	}
	if tag.RowsAffected() != 1 {
		return out, errors.Join(ErrMarchTransition, errors.New("march: field_army row missing"))
	}
	if in.Report != nil {
		reportID, err := t.nextReportID(ctx, tx, table)
		if err != nil {
			return out, err
		}
		p := *in.Report
		p.ReportID = reportID
		rec, err := t.reports.SaveTx(ctx, tx, schema, p)
		if err != nil {
			return out, errors.Join(ErrMarchTransition, err)
		}
		out.ReportID = rec.ReportID
	}
	if err = tx.Commit(ctx); err != nil {
		return ArrivalCommitted{}, errors.Join(ErrMarchTransition, err)
	}
	out.Status, out.ArmyID, out.Survivors = status, in.ArmyID, cloneStacks(in.Survivors)
	return out, nil
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

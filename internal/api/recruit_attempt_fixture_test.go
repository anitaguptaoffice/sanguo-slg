package api

import (
	"crypto/sha256"
	"fmt"
	"reflect"
	"strings"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/jackc/pgx/v5"
)

// Independent SHA-256 vectors from the RULE_EVIDENCE canonical bytes. These
// test-only prices are not a released artifact or permission for production use.
const recruitAttemptPGVersion = "recruit-v1:ee84843ef35d958c0b8fbfc5ae4a2bd0236f385fcc215d9fca3b028b740225b4"
const recruitAttemptPGDigest = "69921906a221d82ed9d74fb220d2166b401cdb35c0a4b8aec960185e68000a5e"

func recruitAttemptPGCatalog(t *testing.T) *march.RecruitCatalog {
	t.Helper()
	var rules [4]march.RecruitRule
	for i := range rules {
		n := int64(i + 1)
		rules[i] = march.RecruitRule{UnitCfgID: int32(n),
			Cost: march.Resources{Food: 2 * n, Wood: 3 * n, Iron: 5 * n, Stone: 7 * n}, SecondsPerUnit: 11 * n}
	}
	catalog, err := march.NewRecruitCatalog([]march.RecruitManifest{{Version: recruitAttemptPGVersion, Rules: rules}}, recruitAttemptPGVersion)
	returnPGOK(t, err)
	return catalog
}

// Frozen exact business SQL at dependency base b8e8c592, with only the captured
// schema qualifier removed. Never derived from a runtime trace or source at test
// time. Labels identify the concrete ACCOUNT/DOM/WORLD/MIL source operation.
var recruitAttemptPGSQL = map[string]string{
	"8b30058a758b4597a146c8e7d5038c274bebe6e238bdf9372ab4f3808c682fa6": "account-proof",
	"c35f4e235365475d3a5b87ff1a5b71db91a19b90750bc06031c73a8b5de45bb7": "wallet-proof",
	"b8fd4d293b748d37d5725a9dc85219215099559efeaa3dd75b6d3a2425a86ac6": "city-proof",
	"24823ffb71f03aa273baf58afe34358f36f3ea1d49a296162789d3339e835473": "military-proof",
	"0d5c09bc5f273ab0c45853d3d8bd606b296d2f99449e24928fa36df3c81f47f4": "actor",
	"e565ccbd97ce436e8b9d6912e2e265720b0075b1edd324a3a9016769d8f4d8b2": "player",
	"a925c8bd2130bd0fc622766478876ec89da931fa4fb945eb05b67e77132b7905": "wallet",
	"88661e6053e94530390c12847db16440b44ab1e5949fd1b9c128be848dbd8ce8": "debit",
	"a92d7239fef4cae4f8b2c7b8f85a732891402624266be2feb363216f9a12ff97": "wallet-read",
	"60f4d558d0f583f5160feb98af4d2f8ad9f065217f793d395d509ba1c28107fd": "city",
	"b02c2d394503e0c579beda0df8277d31fba568d6b7bbe0636fd137837a5366a2": "find",
	"ffc52a102f8bf2c710c06468c0ba8e55dd4e0d38e8c7a61295cefb0b74b83421": "reverse",
	"ea1e866b6c7b60dd0ac2ecfb725207f5adb82431352bfa53c4f039c92d851172": "marker",
	"6353b2b524d2ab866c460890f75688638121284ac3644616964378508255f2ec": "stock",
	"b0dfceca135b14c9687e89aebd4df1249846e4855c9e513b24c7cd7f02464840": "pending",
	"92da62dc3b3f7b341c4a327909755f3e26e99a747f830cef79e3a582a80b7556": "clock",
	"0eaa3767fed5175e8093ba5ad1984f5f640e90f984de6392ee7ef5819b5216c0": "allocate",
	"5b12afe03231cdfc1d611d567d77f602f3489b4fa222260a447d7907796469d0": "job",
	"97942c033afff488a9b03bb90f86e47c970765decaeda6bcaba95e938b5e4a47": "origin",
	"663895617994c19e3f7e93f58f68b7578c9502cdb47ecf9c5ea02c656f66862d": "receipt",
	"b11bb682823c64c5d03c915d29c07eb46fdf621d2359831acae607ca0e8633ac": "readback",
	"dc6b5e507a895e82823ceed65b8b5d4f13f7d78fd2ee41df445a0ddf809d60a4": "history-job",
	"4f55a13eeee399d48a8c27616d898e250ace84e39c87e77240605b4216d97055": "history-receipt",
	"0e46ad2c2897178c4acf98f44d99b0d59504c21a7740b618e13bee25d8d76f26": "history-origin",
}

func recruitAttemptPGStage(sql string, p freshsource.Profile) (string, bool) {
	if sql == "begin isolation level read committed" || sql == "commit" {
		return sql, true
	}
	if recruitPGSQLKind(sql, p) == 4 {
		return "metadata", true
	}
	for i, name := range recruitPGPinNames {
		prefix, mode := "LOCK TABLE ", "ROW EXCLUSIVE"
		if i >= 4 {
			prefix = "LOCK TABLE ONLY "
		}
		if i < 2 || i == 3 {
			mode = "ROW SHARE"
		}
		pin := prefix + pgx.Identifier{p.SchemaName, name}.Sanitize() + " IN " + mode + " MODE"
		if sql == pin {
			return "pin:" + name, true
		}
	}
	normal := strings.ReplaceAll(sql, pgx.Identifier{p.SchemaName}.Sanitize()+".", "")
	// Round-trip qualification rejects unqualified/wrong-schema business SQL;
	// it does not broaden the frozen bytes to an arbitrary schema or suffix.
	qualified := normal
	for _, name := range recruitPGPinNames {
		qualified = strings.ReplaceAll(qualified, pgx.Identifier{name}.Sanitize(), pgx.Identifier{p.SchemaName, name}.Sanitize())
	}
	if qualified != sql {
		return "", false
	}
	stage, ok := recruitAttemptPGSQL[fmt.Sprintf("%x", sha256.Sum256([]byte(normal)))]
	return stage, ok
}

func recruitAttemptPGRecorded(t *testing.T, events []returnPGQuery, observer *pgx.Conn, p freshsource.Profile, replay bool) {
	t.Helper()
	want := []string{"begin isolation level read committed"}
	for _, name := range recruitPGPinNames {
		want = append(want, "pin:"+name)
	}
	want = append(want, strings.Fields("account-proof actor player wallet-proof wallet military-proof find")...)
	if replay {
		want = append(want, strings.Fields("military-proof history-job history-receipt history-origin commit")...)
	} else {
		want = append(want, strings.Fields("military-proof reverse city-proof city military-proof marker stock pending clock allocate debit wallet-read job origin receipt readback commit")...)
	}
	var got []string
	var pid uint32
	reads := 0
	for _, q := range events {
		if pid == 0 {
			pid = q.pid
		}
		if q.pid == 0 || q.pid != pid || q.pid == observer.PgConn().PID() || q.err != nil {
			t.Fatal("unexpected attempt backend, observer reuse or SQL error", q.pid, q.err)
		}
		stage, ok := recruitAttemptPGStage(q.sql, p)
		if !ok {
			t.Fatalf("unexpected attempt SQL: %q", q.sql)
		}
		if stage == "metadata" {
			if len(got) == 0 || got[len(got)-1] == "commit" {
				t.Fatal("source validation escaped the transaction")
			}
			reads++
			continue
		}
		got = append(got, stage)
	}
	if reads == 0 || !reflect.DeepEqual(got, want) {
		t.Fatalf("attempt SQL order/count: got=%v want=%v metadata=%d", got, want, reads)
	}
}

func TestRecruitAttemptPGSQLClassification(t *testing.T) {
	p := freshsource.Profile{SchemaName: `attempt_"Q`}
	account := "SELECT status FROM " + pgx.Identifier{p.SchemaName, "account"}.Sanitize() + " WHERE account_id OPERATOR(pg_catalog.=) $1 FOR SHARE"
	for sql, want := range map[string]string{
		account: "actor", "commit": "commit", "SELECT pg_catalog.nextval($1::pg_catalog.regclass)": "allocate",
		"SELECT pg_catalog.clock_timestamp()": "clock",
	} {
		if got, ok := recruitAttemptPGStage(sql, p); !ok || got != want {
			t.Fatalf("approved SQL rejected: %q stage=%s", sql, got)
		}
	}
	for _, sql := range []string{
		account + "; DELETE FROM player_wallet", "commit; SELECT 1", "rollback", "SELECT 1",
		strings.ReplaceAll(account, pgx.Identifier{p.SchemaName}.Sanitize()+".", ""),
		strings.ReplaceAll(account, pgx.Identifier{p.SchemaName}.Sanitize(), `"other"`),
		"SELECT pg_catalog.setval('work_queue_id_seq',1)", "SELECT pg_catalog.nextval ('work_queue_id_seq')",
		"WITH x AS (DELETE FROM player_wallet RETURNING *) SELECT * FROM x",
	} {
		if stage, ok := recruitAttemptPGStage(sql, p); ok {
			t.Fatalf("unapproved SQL accepted: %q as %s", sql, stage)
		}
	}
}

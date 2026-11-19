package api

import (
	"bytes"
	"os"
	"os/exec"
	"strings"
	"testing"
)

func repoModuleRoot(t *testing.T) string {
	t.Helper()
	out, err := exec.Command("go", "list", "-m", "-f", "{{.Dir}}").Output()
	if err != nil {
		t.Fatalf("module root: %v", err)
	}
	return strings.TrimSpace(string(out))
}

// TestSpecFirstCityLedgerAckLossHarness wires product CI to SPEC #2579 PG17 matrix (isolated schemas).
func TestSpecFirstCityLedgerAckLossHarness(t *testing.T) {
	if os.Getenv("ALLOW_OWNED_PG17_TEST") != "1" {
		t.Skip("ALLOW_OWNED_PG17_TEST=1 required")
	}
	dsn := os.Getenv("FIRST_CITY_LEDGER_TEST_DSN")
	if dsn == "" {
		dsn = os.Getenv("DATABASE_URL")
	}
	if dsn == "" {
		t.Skip("FIRST_CITY_LEDGER_TEST_DSN or DATABASE_URL required")
	}
	root := repoModuleRoot(t)
	cmd := exec.Command("go", "run", "./spec/db/tests/first_city_ledger_ack_loss")
	cmd.Dir = root
	cmd.Env = append(os.Environ(),
		"ALLOW_OWNED_PG17_TEST=1",
		"FIRST_CITY_LEDGER_TEST_DSN="+dsn,
		"GOTOOLCHAIN=local",
	)
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out
	if err := cmd.Run(); err != nil {
		t.Fatalf("ack_loss harness: %v\n%s", err, out.String())
	}
	want := []string{
		"PASS ack_loss: pending_intake_restart_readback_no_biz",
		"PASS ack_loss: pre_commit_disconnect_no_partial_row",
		"PASS ack_loss: intake_commit_ack_loss_no_second_insert",
		"PASS ack_loss: effect_commit_ack_loss_observer_no_double",
		"PASS ack_loss: finalizer_reject_ack_loss_no_city",
		"PASS ack_loss: competitor_ack_loss_no_double_success",
	}
	text := out.String()
	for _, line := range want {
		if !strings.Contains(text, line) {
			t.Fatalf("missing %q in:\n%s", line, text)
		}
	}
}

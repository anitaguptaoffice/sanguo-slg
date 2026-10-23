package account

import "testing"

func TestHashPasswordNeverPlaintext(t *testing.T) {
	hash, err := HashPassword("secret-pass")
	if err != nil {
		t.Fatal(err)
	}
	if hash == "secret-pass" {
		t.Fatal("password stored as plaintext")
	}
	if !CheckPassword(hash, "secret-pass") {
		t.Fatal("expected password to verify")
	}
	if CheckPassword(hash, "wrong") {
		t.Fatal("wrong password should not verify")
	}
}

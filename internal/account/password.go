package account

import (
	"fmt"

	"golang.org/x/crypto/bcrypt"
)

const bcryptCost = bcrypt.DefaultCost

// HashPassword returns a bcrypt hash suitable for account.password_hash.
func HashPassword(plain string) (string, error) {
	if plain == "" {
		return "", fmt.Errorf("password must not be empty")
	}
	b, err := bcrypt.GenerateFromPassword([]byte(plain), bcryptCost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// CheckPassword compares plain text with a stored bcrypt hash.
func CheckPassword(hash, plain string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain)) == nil
}

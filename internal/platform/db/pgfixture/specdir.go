package pgfixture

import (
	"fmt"
	"os"
	"path/filepath"
)

// SpecDir returns the absolute path to spec/db from module root (go.mod).
func SpecDir() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("pgfixture spec dir: %w", err)
	}
	for {
		if info, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil && !info.IsDir() {
			return filepath.Join(dir, "spec", "db"), nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", fmt.Errorf("pgfixture spec dir: go.mod not found from cwd")
		}
		dir = parent
	}
}
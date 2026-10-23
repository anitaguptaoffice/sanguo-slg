// Command loadws runs the PLAT-002 WebSocket connection stress check.
package main

import (
	"fmt"
	"os"

	"github.com/anitaguptaoffice/sanguo-slg/tools/load/wsstress"
)

func main() {
	cfg, err := wsstress.ConfigFromEnv()
	if err != nil {
		fmt.Fprintf(os.Stderr, "config: %v\n", err)
		os.Exit(2)
	}
	if cfg.WSURL == "" {
		fmt.Fprintf(os.Stderr, "set %s to the gateway WebSocket URL\n", "LOAD_WS_URL")
		os.Exit(2)
	}
	res, err := wsstress.Run(cfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "stress failed: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("ok: concurrency=%d elapsed=%s\n", res.Concurrency, res.Elapsed)
}

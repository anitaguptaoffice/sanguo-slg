package main

import (
	"context"
	"fmt"
	"os"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/runtime"
)

func main() {
	ctx := context.Background()
	app, err := runtime.Boot(ctx)
	if err != nil {
		fmt.Fprintf(os.Stderr, "gm boot failed: %v\n", err)
		os.Exit(1)
	}
	defer app.Close()

	app.Log.Info("gm shell ready (stub)", "postgres", app.Config.DatabaseURL, "redis", app.Config.RedisAddr)
	fmt.Println("sanguo-slg gm: platform wiring ok; commands will be added in later milestones.")
}

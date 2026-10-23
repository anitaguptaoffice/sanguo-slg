package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/runtime"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	app, err := runtime.Boot(ctx)
	if err != nil {
		panic(err)
	}
	defer app.Close()

	if err := app.ServeHTTP(ctx); err != nil {
		app.Log.Error("server stopped", "err", err)
		os.Exit(1)
	}
}

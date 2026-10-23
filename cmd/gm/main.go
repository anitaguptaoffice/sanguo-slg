package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content/mail"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/runtime"
)

func main() {
	ctx := context.Background()
	if len(os.Args) < 2 {
		smokeBoot(ctx)
		return
	}
	cmd := os.Args[1]
	switch cmd {
	case "lookup", "grant", "kick", "mute", "send-mail":
	case "help", "-h", "--help":
		usage()
		return
	default:
		fmt.Fprintf(os.Stderr, "unknown command %q\n", cmd)
		usage()
		os.Exit(2)
	}

	app, err := runtime.Boot(ctx)
	if err != nil {
		fmt.Fprintf(os.Stderr, "gm boot failed: %v\n", err)
		os.Exit(1)
	}
	defer app.Close()

	gm := api.NewGmService(app.Log, app.DB, nil, nil)
	fs := flag.NewFlagSet(cmd, flag.ExitOnError)
	common := bindCommonFlags(fs)
	serverID := fs.Int("server-id", 1, "game server id")
	playerID := fs.Int64("player-id", 0, "player id")
	login := fs.String("login", "", "account login name")
	idem := fs.String("idempotency-key", "", "grant idempotency key")
	rewardsJSON := fs.String("rewards-json", "", "grant rewards JSON (content.RewardPackage schema)")
	muteUntil := fs.Int64("mute-until-ms", 0, "mute deadline unix ms (0=unmute)")
	title := fs.String("title", "", "mail title (send-mail)")
	body := fs.String("body", "", "mail body (send-mail)")
	mailType := fs.Int("mail-type", int(mail.TypeReward), "mail type: 1=system 2=reward 3=announcement")
	food := fs.Int64("food", 0, "grant food (shortcut)")
	gold := fs.Int64("gold", 0, "grant gold (shortcut)")
	_ = fs.Parse(os.Args[2:])

	audit, token, err := common.materialize()
	if err != nil {
		fmt.Fprintf(os.Stderr, "%v\n", err)
		os.Exit(1)
	}

	switch cmd {
	case "lookup":
		res, info, err := gm.LookupPlayer(ctx, token, audit, int32(*serverID), *playerID, *login)
		exitJSON(err, map[string]any{"result": res, "player": info})
	case "grant":
		if *playerID == 0 {
			fatal("grant requires --player-id")
		}
		pkg, err := parseRewards(*rewardsJSON, *food, *gold)
		if err != nil {
			fatal(err.Error())
		}
		res, grant, err := gm.GrantReward(ctx, token, audit, int32(*serverID), *playerID, pkg, *idem)
		exitJSON(err, map[string]any{"result": res, "grant": grant})
	case "kick":
		if *playerID == 0 {
			fatal("kick requires --player-id")
		}
		res, ok, err := gm.KickPlayer(ctx, token, audit, int32(*serverID), *playerID)
		exitJSON(err, map[string]any{"result": res, "session_terminated": ok})
	case "mute":
		if *playerID == 0 {
			fatal("mute requires --player-id")
		}
		res, until, err := gm.MutePlayer(ctx, token, audit, int32(*serverID), *playerID, *muteUntil)
		exitJSON(err, map[string]any{"result": res, "chat_muted_until_ms": until})
	case "send-mail":
		if *playerID == 0 {
			fatal("send-mail requires --player-id")
		}
		if strings.TrimSpace(*title) == "" {
			fatal("send-mail requires --title")
		}
		pkg, err := parseRewards(*rewardsJSON, *food, *gold)
		if err != nil && strings.TrimSpace(*rewardsJSON) == "" && *food == 0 && *gold == 0 {
			pkg = content.RewardPackage{}
			err = nil
		}
		if err != nil {
			fatal(err.Error())
		}
		if _, _, err := gm.LookupPlayer(ctx, token, audit, int32(*serverID), *playerID, ""); err != nil {
			exitJSON(err, nil)
		}
		mailSvc := mail.NewService(mail.NewPGStore(app.DB), nil, app.Log)
		row, err := mailSvc.Send(ctx, int32(*serverID), *playerID, int16(*mailType), *title, *body, pkg, mail.SendAudit{
			OperatorID: audit.OperatorID, OperatorName: audit.OperatorName, Reason: audit.Reason, TicketID: audit.TicketID,
		})
		exitJSON(err, map[string]any{"mail": row})
	}
}

type commonFlags struct {
	token        *string
	operatorID   *string
	operatorName *string
	reason       *string
	ticketID     *string
}

func bindCommonFlags(fs *flag.FlagSet) *commonFlags {
	return &commonFlags{
		token:        fs.String("token", os.Getenv("GM_TOKEN"), "GM auth token (or GM_TOKEN env)"),
		operatorID:   fs.String("operator-id", "", "operator id (required)"),
		operatorName: fs.String("operator-name", "", "operator display name"),
		reason:       fs.String("reason", "", "operation reason (required)"),
		ticketID:     fs.String("ticket-id", "", "ticket / approval id"),
	}
}

func (c *commonFlags) materialize() (api.GmAudit, string, error) {
	audit := api.GmAudit{
		OperatorID:   strings.TrimSpace(*c.operatorID),
		OperatorName: strings.TrimSpace(*c.operatorName),
		Reason:       strings.TrimSpace(*c.reason),
		TicketID:     strings.TrimSpace(*c.ticketID),
	}
	if audit.OperatorID == "" || audit.Reason == "" {
		return audit, "", fmt.Errorf("gm: --operator-id and --reason are required")
	}
	return audit, strings.TrimSpace(*c.token), nil
}

func parseRewards(raw string, food, gold int64) (content.RewardPackage, error) {
	var pkg content.RewardPackage
	if strings.TrimSpace(raw) != "" {
		if err := json.Unmarshal([]byte(raw), &pkg); err != nil {
			return content.RewardPackage{}, err
		}
	}
	if food != 0 || gold != 0 {
		if pkg.Resources == nil {
			pkg.Resources = map[string]int64{}
		}
		if food != 0 {
			pkg.Resources["food"] = food
		}
		if gold != 0 {
			pkg.Resources["gold"] = gold
		}
	}
	if len(pkg.Resources) == 0 && len(pkg.Items) == 0 {
		return content.RewardPackage{}, fmt.Errorf("gm: specify --rewards-json or --food/--gold")
	}
	return pkg, nil
}

func exitJSON(err error, v any) {
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	_ = enc.Encode(v)
}

func fatal(msg string) {
	fmt.Fprintf(os.Stderr, "%s\n", msg)
	os.Exit(1)
}

func smokeBoot(ctx context.Context) {
	app, err := runtime.Boot(ctx)
	if err != nil {
		fmt.Fprintf(os.Stderr, "gm boot failed: %v\n", err)
		os.Exit(1)
	}
	defer app.Close()
	app.Log.Info("gm ready", "postgres", app.Config.DatabaseURL, "redis", app.Config.RedisAddr)
	fmt.Println("sanguo-slg gm: platform wiring ok; subcommands lookup|grant|kick|mute|send-mail")
	fmt.Println("smoke: see tools/smoke/README.md (INTG-007 TestINTG007M4DeepSmokePath; INTG-006 TestINTG006Data002SmokePath)")
}

func usage() {
	fmt.Fprintf(os.Stderr, `sanguo-slg gm — operator CLI (GM-001)

Usage:
  gm lookup --server-id=1 (--player-id=ID | --login=NAME) --operator-id=... --reason=...
  gm grant  --server-id=1 --player-id=ID --idempotency-key=KEY --food=1000 --operator-id=... --reason=...
  gm kick   --server-id=1 --player-id=ID --operator-id=... --reason=...
  gm mute   --server-id=1 --player-id=ID [--mute-until-ms=MS] --operator-id=... --reason=...
  gm send-mail --server-id=1 --player-id=ID --title=T --body=B [--mail-type=2] [--rewards-json=...] --operator-id=... --reason=...

Auth: set GM_TOKEN and pass --token (or env). Optional GM_OPERATOR_WHITELIST=op1,op2.

HTTP (when mounted via api.MountGmHTTP): POST /gm/lookup|grant|kick|mute JSON body.

`)
}

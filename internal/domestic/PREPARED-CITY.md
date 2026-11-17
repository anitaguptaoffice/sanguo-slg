# DOM PreparedCity (default-off)
`Prepare` clones template + Hub gate. `Close` releases gate. `LockWallet` captures Access after wallet FOR UPDATE; failures use `freshDomesticSource.failure`. `Stage` is one-shot on success; post-Consume DOM failure needs whole-tx rollback. `Publish` is Hub-only, no SQL.

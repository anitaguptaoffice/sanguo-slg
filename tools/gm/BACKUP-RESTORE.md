# GM 备份与回滚演练

`tools/gm/backup_restore.sh` 提供三条命令：

```bash
# 1. 自定义格式备份
PGPASSWORD=sanguo tools/gm/backup_restore.sh backup sanguo main.dump

# 2. 恢复到临时库并校验核心不变量（不影响线上库）
PGPASSWORD=sanguo tools/gm/backup_restore.sh verify sanguo main.dump

# 3. 强制回滚（会先 drop 目标库）
PGPASSWORD=sanguo tools/gm/backup_restore.sh restore sanguo main.dump --force
```

验收标准：

- `verify` 在临时库 `main_restorecheck` 完成恢复后输出迁移数、账号数、玩家数、城池数与孤儿城池数。
- 孤儿城池必须为 0。
- 回滚演练在停服窗口执行，执行前确认已有可用备份。

#!/usr/bin/env python3
"""把 tasks/backlog.yml 同步成 GitHub Issues。

用法：
    python3 tools/tasks_sync.py            # 同步（幂等）
    python3 tools/tasks_sync.py --dry-run  # 只看会做什么

依赖：gh（已登录）、PyYAML
"""
import json
import subprocess
import sys

import yaml

LABELS = {
    "domain": ["spec", "platform", "account", "world", "domestic", "military", "hero", "content", "client", "tools"],
    "wave": ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    "size": ["S", "M", "L"],
}
STATUS = ["status:ready", "status:blocked", "status:in-progress", "status:review", "status:done"]


def run(args, check=True):
    r = subprocess.run(args, capture_output=True, text=True)
    if check and r.returncode != 0:
        raise SystemExit(f"{' '.join(args)}\n{r.stderr}")
    return r.stdout.strip()


def ensure_labels():
    for group, values in LABELS.items():
        for v in values:
            run(["gh", "label", "create", f"{group}:{v}", "--force",
                 "--color", "ededed", "--description", f"{group}={v}"], check=False)
    colors = {"ready": "0e8a16", "blocked": "b60205", "in-progress": "fbca04",
              "review": "1d76db", "done": "5319e7"}
    for s in STATUS:
        name = s.split(":")[1]
        run(["gh", "label", "create", s, "--force",
             "--color", colors[name], "--description", s], check=False)
    run(["gh", "label", "create", "type:task", "--force",
         "--color", "c5def5", "--description", "任务卡"], check=False)


def existing_issues():
    out = run(["gh", "issue", "list", "--state", "all", "--limit", "500",
               "--json", "number,title,body,labels"])
    return {i["title"].split("]")[0] + "]": i for i in json.loads(out)}


def render_body(card):
    lines = [card.get("body", "").strip(), ""]
    lines.append("## 验收标准")
    for a in card.get("acceptance", []):
        lines.append(f"- [ ] {a}")
    lines += ["", "## 边界", f"- 允许修改：`{card['owner_dir']}`"]
    if card.get("scope"):
        lines.append(f"- scope：{', '.join(f'`{s}`' for s in card['scope'])}")
    if card.get("out_of_scope"):
        lines.append(f"- 禁止修改：{', '.join(f'`{s}`' for s in card['out_of_scope'])}")
    if card.get("depends_on"):
        lines.append(f"- 依赖：{', '.join(card['depends_on'])}")
    lines += ["", "## 协作约定", "见仓库根目录 `AGENTS.md`。"]
    return "\n".join(lines)


def labels_for(card):
    sync = card.get("sync_status")
    if sync in ("ready", "blocked"):
        status = f"status:{sync}"
    elif card.get("blocked_until") or card.get("depends_on"):
        status = "status:blocked"
    else:
        status = "status:ready"
    return [
        "type:task",
        f"domain:{card['domain']}",
        f"wave:{card['wave']}",
        f"size:{card['size']}",
        status,
    ]


def main():
    dry = "--dry-run" in sys.argv
    cards = yaml.safe_load(open("tasks/backlog.yml"))
    if not dry:
        ensure_labels()
    have = existing_issues() if not dry else {}
    created = updated = 0

    for card in cards:
        title = f"[{card['id']}] {card['title']}"
        body = render_body(card)
        labels = labels_for(card)
        key = f"[{card['id']}]"

        if key in have:
            cur = have[key]
            if dry:
                print(f"update #{cur['number']} {title}")
            else:
                run(["gh", "issue", "edit", str(cur["number"]),
                     "--body", body] + sum([["--add-label", l] for l in labels], []))
                print(f"updated #{cur['number']} {title}")
            updated += 1
        else:
            if dry:
                print(f"create {title} {labels}")
            else:
                out = run(["gh", "issue", "create", "--title", title,
                           "--body", body] + sum([["--label", l] for l in labels], []))
                print(f"created {out} {title}")
            created += 1

    print(f"\ncreated={created} updated={updated}")


if __name__ == "__main__":
    main()

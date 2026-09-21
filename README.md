# SCOUT

Robinhood Chain open-status desk. Paste a contract address on the phone browser → live receipt from Job A `book.jsonl`.

## Live

https://rh-scout.vercel.app/

## Data

Public index shards live under `/data/ca/{prefix}.json` (first 2 hex chars after `0x`) plus `/data/meta.json`.

- Built on the Capital VPS from `/home/ricky/capital-builder/sits/book.jsonl` (latest row wins per token).
- Refreshed every **2 minutes** by systemd user timer `scout-book-index.timer` → pushes to this repo → Vercel auto-deploys.
- **Public fields only.** Desk actions (`IGNORE` / `SIZED_YES` / `CLIP` / `HOLD`) stay private and are never shipped to the site.

## Local / VPS

```bash
python3 /home/ricky/capital-builder/scout-public/build_index.py
/home/ricky/capital-builder/scout-public/push_index.sh
```

## Deploy

Static site on Vercel (framework: Other). Do not link `panrix/Capital` to this project.

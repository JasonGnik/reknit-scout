# Reknit Scout

Reddit lead-finder for [Reknit](https://reknit-app.com). Crawls injury-related subreddits, ranks high-fit posts using Claude, drafts founder-voiced replies, and outputs a daily digest you review by hand. Every reply stays human-approved — Scout never posts on its own.

## Quick start

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# Fill in ANTHROPIC_API_KEY and Reddit credentials.

# 3. Create a Reddit "script" app
# https://www.reddit.com/prefs/apps → "create another app" → script
# redirect uri: http://localhost (any string is fine for script apps)
# Copy client id (under the app name) and secret into .env.

# 4. Run
npm run scout              # full pipeline: crawl → classify → draft → digest
npm run scout -- --dry-run # crawl + show what would be inserted, no DB writes, no API spend
npm run scout:digest       # regenerate digest from existing DB (no crawl)
```

The digest is written to `out/digest-YYYY-MM-DD.html`. Open it in a browser, review, copy/edit replies, and post manually.

## Architecture

```
crawl  →  pre-filter  →  classify  →  draft  →  digest
(Reddit API)  (keywords)  (Haiku)   (Sonnet)   (HTML+MD)
```

- **crawl** — pulls last 24h of new posts from `data/subreddits.json`.
- **pre-filter** — keyword match against `data/keywords.json` (injury + intent terms; exclusions hard-skip post-op, fractures, pediatric, etc.). Cheap; no API cost.
- **classify** — single Haiku call per kept post: intent, injury type, stage, fit score 0–10, red-flag detection.
- **draft** — Sonnet call for posts with fit ≥ `SCOUT_MIN_FIT_SCORE` (default 6): generates a comment draft + a DM draft, gated by per-subreddit policy.
- **digest** — writes `out/digest-<date>.html` and `.md`. Sorted by fit, then draft confidence.

## Anti-ban hygiene

- **Never auto-posts.** Drafts only.
- One Reddit account (the founder's). No sockpuppets.
- ≤3 outbound replies/day, ≤5 DMs/day, manually paced.
- Always edit before posting — never copy-paste.
- Disclosure ("I built this") included whenever Reknit is mentioned.
- Per-subreddit `allow_app_mention` / `prefer_dm` rules enforced at draft time.

## Cost

~$5–15/month in Anthropic API at typical pipeline volume (50 posts/day, ~15 drafts).
Capped by `SCOUT_MAX_DRAFTS_PER_RUN`. Workspace spend limit recommended: $30/mo.

## Env vars

See `.env.example`. Tunables:

| Var | Default | What it does |
|---|---|---|
| `SCOUT_LOOKBACK_HOURS` | 24 | How far back to pull new posts. |
| `SCOUT_MIN_FIT_SCORE` | 6 | Drafts only generated for posts at/above this. |
| `SCOUT_MAX_DRAFTS_PER_RUN` | 15 | Hard cap to prevent runaway spend. |

## Files

- `data/subreddits.json` — sub list + per-sub policy (mention OK? DM-only? mod strictness?). Edit as you discover new subs or get warned.
- `data/keywords.json` — injury terms, intent terms, exclusions.
- `prompts/classify.md` — Haiku classify prompt.
- `prompts/draft-reply.md` — Sonnet draft prompt with voice rules.
- `db/leads.db` — SQLite, gitignored. Tracks every seen post, classification, draft, status.
- `out/digest-*.html` — daily digest, gitignored.

## Roadmap (post-v0)

- Web dashboard with one-click "approve & send" via Reddit API
- Auto-rotation of Reddit comment auth (refresh tokens, persistent session)
- Status workflow (drafted → sent → replied → converted) with reply tracking
- Slack/Discord webhook for daily digest delivery
- A/B test draft prompts on conversion rate

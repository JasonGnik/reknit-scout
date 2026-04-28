import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';

mkdirSync(dirname(config.paths.db), { recursive: true });

export const db = new Database(config.paths.db);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,                  -- reddit post id (e.g. t3_abc123)
    subreddit TEXT NOT NULL,
    author TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    permalink TEXT NOT NULL,
    created_utc INTEGER NOT NULL,
    seen_at TEXT NOT NULL DEFAULT (datetime('now')),

    -- pre-filter
    matched_injury_terms TEXT,            -- JSON array
    matched_intent_terms TEXT,            -- JSON array

    -- classify
    classified_at TEXT,
    intent TEXT,
    injury_type TEXT,
    stage TEXT,
    fit_score INTEGER,
    classify_reasoning TEXT,
    risks TEXT,                           -- JSON array
    red_flags TEXT,                       -- JSON array

    -- draft
    drafted_at TEXT,
    comment_draft TEXT,
    dm_draft TEXT,
    mention_strategy TEXT,
    draft_confidence INTEGER,
    draft_warnings TEXT,                  -- JSON array

    -- workflow
    status TEXT NOT NULL DEFAULT 'new',   -- new | drafted | sent | skipped | replied | converted
    sent_at TEXT,
    notes TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
  CREATE INDEX IF NOT EXISTS idx_leads_fit ON leads(fit_score DESC);
  CREATE INDEX IF NOT EXISTS idx_leads_subreddit ON leads(subreddit);
`);

export type LeadRow = {
  id: string;
  subreddit: string;
  author: string;
  title: string;
  body: string | null;
  permalink: string;
  created_utc: number;
  fit_score: number | null;
  intent: string | null;
  injury_type: string | null;
  stage: string | null;
  classify_reasoning: string | null;
  comment_draft: string | null;
  dm_draft: string | null;
  mention_strategy: string | null;
  draft_confidence: number | null;
  status: string;
};

export function hasLead(id: string): boolean {
  const row = db.prepare('SELECT 1 FROM leads WHERE id = ?').get(id);
  return !!row;
}

export function insertLead(row: {
  id: string;
  subreddit: string;
  author: string;
  title: string;
  body: string | null;
  permalink: string;
  created_utc: number;
  matched_injury_terms: string[];
  matched_intent_terms: string[];
}) {
  db.prepare(`
    INSERT INTO leads (id, subreddit, author, title, body, permalink, created_utc, matched_injury_terms, matched_intent_terms)
    VALUES (@id, @subreddit, @author, @title, @body, @permalink, @created_utc, @injury, @intent)
  `).run({
    ...row,
    injury: JSON.stringify(row.matched_injury_terms),
    intent: JSON.stringify(row.matched_intent_terms),
  });
}

export function updateClassification(id: string, c: {
  intent: string;
  injury_type: string;
  stage: string;
  fit_score: number;
  reasoning: string;
  risks: string[];
  red_flags: string[];
}) {
  db.prepare(`
    UPDATE leads SET
      classified_at = datetime('now'),
      intent = @intent,
      injury_type = @injury_type,
      stage = @stage,
      fit_score = @fit_score,
      classify_reasoning = @reasoning,
      risks = @risks,
      red_flags = @red_flags
    WHERE id = @id
  `).run({
    id,
    intent: c.intent,
    injury_type: c.injury_type,
    stage: c.stage,
    fit_score: c.fit_score,
    reasoning: c.reasoning,
    risks: JSON.stringify(c.risks),
    red_flags: JSON.stringify(c.red_flags),
  });
}

export function updateDraft(id: string, d: {
  comment_draft: string | null;
  dm_draft: string;
  mention_strategy: string;
  confidence: number;
  warnings: string[];
}) {
  db.prepare(`
    UPDATE leads SET
      drafted_at = datetime('now'),
      comment_draft = @comment_draft,
      dm_draft = @dm_draft,
      mention_strategy = @mention_strategy,
      draft_confidence = @confidence,
      draft_warnings = @warnings,
      status = 'drafted'
    WHERE id = @id
  `).run({
    id,
    comment_draft: d.comment_draft,
    dm_draft: d.dm_draft,
    mention_strategy: d.mention_strategy,
    confidence: d.confidence,
    warnings: JSON.stringify(d.warnings),
  });
}

export function getLeadsToClassify(limit: number): { id: string; subreddit: string; title: string; body: string | null }[] {
  return db.prepare(`
    SELECT id, subreddit, title, body FROM leads
    WHERE classified_at IS NULL
    ORDER BY created_utc DESC
    LIMIT ?
  `).all(limit) as { id: string; subreddit: string; title: string; body: string | null }[];
}

export function getLeadsToDraft(minFitScore: number, limit: number): { id: string; subreddit: string; title: string; body: string | null; intent: string; injury_type: string; stage: string; fit_score: number; classify_reasoning: string; risks: string }[] {
  return db.prepare(`
    SELECT id, subreddit, title, body, intent, injury_type, stage, fit_score, classify_reasoning, risks
    FROM leads
    WHERE classified_at IS NOT NULL
      AND drafted_at IS NULL
      AND fit_score >= ?
      AND status = 'new'
    ORDER BY fit_score DESC, created_utc DESC
    LIMIT ?
  `).all(minFitScore, limit) as any[];
}

export function getDigestLeads(minFitScore: number): LeadRow[] {
  return db.prepare(`
    SELECT id, subreddit, author, title, body, permalink, created_utc, fit_score, intent, injury_type, stage, classify_reasoning, comment_draft, dm_draft, mention_strategy, draft_confidence, status
    FROM leads
    WHERE drafted_at IS NOT NULL
      AND status IN ('drafted', 'new')
      AND fit_score >= ?
    ORDER BY fit_score DESC, draft_confidence DESC, created_utc DESC
  `).all(minFitScore) as LeadRow[];
}

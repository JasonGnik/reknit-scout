import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key} — copy .env.example to .env and fill it in.`);
  return v;
}

export const config = {
  anthropicKey: required('ANTHROPIC_API_KEY'),
  reddit: {
    clientId: required('REDDIT_CLIENT_ID'),
    clientSecret: required('REDDIT_CLIENT_SECRET'),
    username: required('REDDIT_USERNAME'),
    password: required('REDDIT_PASSWORD'),
    userAgent: process.env.REDDIT_USER_AGENT ?? 'reknit-scout/0.0.1',
  },
  lookbackHours: Number(process.env.SCOUT_LOOKBACK_HOURS ?? 24),
  minFitScore: Number(process.env.SCOUT_MIN_FIT_SCORE ?? 6),
  maxDraftsPerRun: Number(process.env.SCOUT_MAX_DRAFTS_PER_RUN ?? 15),
  paths: {
    root,
    db: join(root, 'db', 'leads.db'),
    subreddits: join(root, 'data', 'subreddits.json'),
    keywords: join(root, 'data', 'keywords.json'),
    classifyPrompt: join(root, 'prompts', 'classify.md'),
    draftPrompt: join(root, 'prompts', 'draft-reply.md'),
    out: join(root, 'out'),
  },
};

export type SubredditPolicy = {
  name: string;
  allow_app_mention: boolean;
  requires_disclosure: boolean;
  prefer_dm: boolean;
  mod_strictness: 'low' | 'med' | 'high';
  relevant_patterns: string[];
  notes?: string;
};

export type Keywords = {
  injury_terms: string[];
  intent_terms: string[];
  exclusion_terms: string[];
};

export function loadSubreddits(): SubredditPolicy[] {
  return JSON.parse(readFileSync(config.paths.subreddits, 'utf8'));
}

export function loadKeywords(): Keywords {
  return JSON.parse(readFileSync(config.paths.keywords, 'utf8'));
}

export function loadPrompt(which: 'classify' | 'draft'): string {
  const p = which === 'classify' ? config.paths.classifyPrompt : config.paths.draftPrompt;
  return readFileSync(p, 'utf8');
}

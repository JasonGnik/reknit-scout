import { config, loadKeywords, loadSubreddits } from './config.js';
import { fetchRecent } from './reddit.js';
import { preFilter } from './filter.js';
import { classify } from './classify.js';
import { draft } from './draft.js';
import { writeDigest } from './digest.js';
import { hasLead, insertLead, getLeadsToClassify, getLeadsToDraft, updateClassification, updateDraft } from './db.js';

const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry-run');
const ONLY_DIGEST = args.has('--digest');

async function crawl() {
  const subs = loadSubreddits();
  const kw = loadKeywords();
  let total = 0;
  let kept = 0;
  for (const s of subs) {
    process.stdout.write(`r/${s.name}… `);
    try {
      const posts = await fetchRecent(s.name, config.lookbackHours);
      total += posts.length;
      for (const p of posts) {
        if (hasLead(p.id)) continue;
        const f = preFilter(p, kw);
        if (!f.keep) continue;
        kept++;
        if (DRY) continue;
        insertLead({
          id: p.id,
          subreddit: p.subreddit,
          author: p.author,
          title: p.title,
          body: p.body,
          permalink: p.permalink,
          created_utc: p.created_utc,
          matched_injury_terms: f.matched_injury_terms,
          matched_intent_terms: f.matched_intent_terms,
        });
      }
      console.log(`${posts.length} fetched`);
    } catch (e: any) {
      console.log(`ERROR: ${e.message}`);
    }
  }
  console.log(`\nCrawl complete: ${total} fetched, ${kept} kept after pre-filter.`);
}

async function classifyPending() {
  const todo = getLeadsToClassify(50);
  console.log(`\nClassifying ${todo.length} new lead(s)…`);
  for (const l of todo) {
    try {
      const c = await classify(l);
      if (!DRY) updateClassification(l.id, c);
      console.log(`  [${c.fit_score}/10] r/${l.subreddit} — ${l.title.slice(0, 60)}…  (${c.injury_type}/${c.stage})`);
    } catch (e: any) {
      console.log(`  ERR ${l.id}: ${e.message}`);
    }
  }
}

async function draftPending() {
  const subs = loadSubreddits();
  const policyByName = new Map(subs.map((s) => [s.name.toLowerCase(), s]));

  const todo = getLeadsToDraft(config.minFitScore, config.maxDraftsPerRun);
  console.log(`\nDrafting replies for ${todo.length} qualified lead(s)…`);
  for (const l of todo) {
    const policy = policyByName.get(l.subreddit.toLowerCase());
    if (!policy) {
      console.log(`  skip ${l.id}: no policy for r/${l.subreddit}`);
      continue;
    }
    try {
      const d = await draft({
        post: { subreddit: l.subreddit, title: l.title, body: l.body },
        classification: {
          intent: l.intent,
          injury_type: l.injury_type,
          stage: l.stage,
          fit_score: l.fit_score,
          reasoning: l.classify_reasoning,
          risks: l.risks,
        },
        policy,
      });
      if (!DRY) updateDraft(l.id, d);
      console.log(`  drafted [${d.confidence}/10] ${d.mention_strategy} — r/${l.subreddit}`);
    } catch (e: any) {
      console.log(`  ERR ${l.id}: ${e.message}`);
    }
  }
}

async function main() {
  if (ONLY_DIGEST) {
    const { mdPath, htmlPath, count } = writeDigest();
    console.log(`Digest: ${count} leads → ${mdPath}\n              ${htmlPath}`);
    return;
  }

  console.log(`Reknit Scout · lookback=${config.lookbackHours}h · minFit=${config.minFitScore} · maxDrafts=${config.maxDraftsPerRun}${DRY ? ' · DRY-RUN' : ''}\n`);
  await crawl();
  await classifyPending();
  await draftPending();
  const { mdPath, htmlPath, count } = writeDigest();
  console.log(`\nDigest: ${count} leads`);
  console.log(`  → ${mdPath}`);
  console.log(`  → ${htmlPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

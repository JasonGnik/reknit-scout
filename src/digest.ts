import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config.js';
import { getDigestLeads, LeadRow } from './db.js';

function fmtTime(unix: number): string {
  return new Date(unix * 1000).toISOString().replace('T', ' ').replace(/:\d\d\..+/, '');
}

function escape(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function writeDigest(): { mdPath: string; htmlPath: string; count: number } {
  mkdirSync(config.paths.out, { recursive: true });
  const leads = getDigestLeads(config.minFitScore);
  const date = new Date().toISOString().slice(0, 10);

  // Markdown digest — easy to read in editor.
  const md = renderMarkdown(leads, date);
  const mdPath = join(config.paths.out, `digest-${date}.md`);
  writeFileSync(mdPath, md);

  // HTML digest — open in browser, copy reply, click permalink.
  const html = renderHTML(leads, date);
  const htmlPath = join(config.paths.out, `digest-${date}.html`);
  writeFileSync(htmlPath, html);

  return { mdPath, htmlPath, count: leads.length };
}

function renderMarkdown(leads: LeadRow[], date: string): string {
  const lines: string[] = [
    `# Reknit Scout — ${date}`,
    ``,
    `${leads.length} leads ready for review (fit ≥ ${config.minFitScore}).`,
    ``,
  ];
  for (const l of leads) {
    lines.push(`---`, ``);
    lines.push(`## [${l.fit_score}/10] r/${l.subreddit} — ${l.title}`);
    lines.push(``);
    lines.push(`**Author:** u/${l.author} · **Posted:** ${fmtTime(l.created_utc)} · **Type:** ${l.injury_type} (${l.stage}) · **Intent:** ${l.intent}`);
    lines.push(`**Why:** ${l.classify_reasoning ?? ''}`);
    lines.push(`**Link:** ${l.permalink}`);
    lines.push(``);
    if (l.body) {
      lines.push(`> ${l.body.slice(0, 500).replace(/\n+/g, '\n> ')}${l.body.length > 500 ? '…' : ''}`);
      lines.push(``);
    }
    lines.push(`**Strategy:** ${l.mention_strategy} · **Confidence:** ${l.draft_confidence ?? '?'}/10`);
    lines.push(``);
    if (l.comment_draft) {
      lines.push(`### Comment draft`);
      lines.push('```');
      lines.push(l.comment_draft);
      lines.push('```');
      lines.push(``);
    }
    if (l.dm_draft) {
      lines.push(`### DM draft`);
      lines.push('```');
      lines.push(l.dm_draft);
      lines.push('```');
      lines.push(``);
    }
  }
  return lines.join('\n');
}

function renderHTML(leads: LeadRow[], date: string): string {
  const cards = leads.map((l) => `
    <article>
      <header>
        <span class="score">${l.fit_score}/10</span>
        <span class="sub">r/${escape(l.subreddit)}</span>
        <span class="meta">${escape(l.injury_type ?? '')} · ${escape(l.stage ?? '')} · ${escape(l.intent ?? '')}</span>
      </header>
      <h2><a href="${escape(l.permalink)}" target="_blank" rel="noopener">${escape(l.title)}</a></h2>
      <p class="why">${escape(l.classify_reasoning ?? '')}</p>
      ${l.body ? `<details><summary>Post body</summary><pre>${escape(l.body)}</pre></details>` : ''}
      <p class="strategy"><strong>${escape(l.mention_strategy ?? '')}</strong> · confidence ${l.draft_confidence ?? '?'}/10</p>
      ${l.comment_draft ? `<section><h3>Comment</h3><textarea readonly onclick="this.select()">${escape(l.comment_draft)}</textarea><button onclick="navigator.clipboard.writeText(this.previousElementSibling.value)">Copy</button></section>` : ''}
      ${l.dm_draft ? `<section><h3>DM</h3><textarea readonly onclick="this.select()">${escape(l.dm_draft)}</textarea><button onclick="navigator.clipboard.writeText(this.previousElementSibling.value)">Copy</button></section>` : ''}
    </article>
  `).join('\n');

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Scout digest ${date}</title>
<style>
  body { font: 14px/1.5 -apple-system, system-ui, sans-serif; max-width: 880px; margin: 2rem auto; padding: 0 1rem; color: #222; }
  h1 { margin-bottom: 0.5rem; }
  article { border: 1px solid #e5e5e5; border-radius: 12px; padding: 1rem 1.25rem; margin: 1rem 0; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
  header { display: flex; gap: 0.75rem; align-items: center; margin-bottom: 0.5rem; font-size: 12px; color: #666; }
  .score { background: #3B82F6; color: white; font-weight: 700; padding: 2px 8px; border-radius: 10px; }
  .sub { font-weight: 600; color: #222; }
  h2 { margin: 0.25rem 0 0.5rem; font-size: 16px; }
  h2 a { color: #1a1a1a; text-decoration: none; }
  h2 a:hover { text-decoration: underline; }
  .why { color: #555; font-style: italic; margin: 0.25rem 0 0.5rem; }
  .strategy { margin: 0.5rem 0; font-size: 12px; color: #666; }
  textarea { width: 100%; min-height: 120px; font: 13px/1.5 ui-monospace, monospace; padding: 0.5rem; border: 1px solid #ddd; border-radius: 6px; }
  button { margin-top: 0.25rem; padding: 4px 10px; font-size: 12px; cursor: pointer; border: 1px solid #ccc; border-radius: 6px; background: #f8f8f8; }
  details { margin: 0.5rem 0; font-size: 13px; }
  pre { white-space: pre-wrap; background: #f6f6f6; padding: 0.5rem; border-radius: 6px; max-height: 200px; overflow: auto; }
  section h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin: 0.75rem 0 0.25rem; }
</style></head>
<body>
  <h1>Reknit Scout — ${date}</h1>
  <p>${leads.length} leads (fit ≥ ${config.minFitScore}). Sorted by fit score, then draft confidence.</p>
  ${cards}
</body></html>`;
}

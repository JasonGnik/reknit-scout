import { Keywords } from './config.js';
import { RawPost } from './reddit.js';

export type FilterResult = {
  keep: boolean;
  matched_injury_terms: string[];
  matched_intent_terms: string[];
  matched_exclusions: string[];
};

function findMatches(haystack: string, needles: string[]): string[] {
  const matches: string[] = [];
  for (const n of needles) {
    if (haystack.includes(n.toLowerCase())) matches.push(n);
  }
  return matches;
}

export function preFilter(post: RawPost, kw: Keywords): FilterResult {
  const blob = `${post.title}\n${post.body}`.toLowerCase();
  const injury = findMatches(blob, kw.injury_terms);
  const intent = findMatches(blob, kw.intent_terms);
  const exclusions = findMatches(blob, kw.exclusion_terms);

  // Need at least one injury term. Intent term is a strong signal but not required
  // (some posts just describe symptoms — those still get classified).
  // Exclusions hard-disqualify (post-op, fractures, pediatric, etc.).
  const keep = injury.length > 0 && exclusions.length === 0;

  return {
    keep,
    matched_injury_terms: injury,
    matched_intent_terms: intent,
    matched_exclusions: exclusions,
  };
}

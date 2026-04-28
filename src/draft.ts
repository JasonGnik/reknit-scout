import { loadPrompt, SubredditPolicy } from './config.js';
import { callJSON } from './anthropic.js';

const SYSTEM = loadPrompt('draft');

export type Draft = {
  comment_draft: string | null;
  dm_draft: string;
  mention_strategy: 'in_comment' | 'dm_only' | 'no_mention';
  confidence: number;
  warnings: string[];
};

export async function draft(input: {
  post: { subreddit: string; title: string; body: string | null };
  classification: { intent: string; injury_type: string; stage: string; fit_score: number; reasoning: string; risks: string };
  policy: SubredditPolicy;
}): Promise<Draft> {
  const user = [
    `# Post`,
    `Subreddit: r/${input.post.subreddit}`,
    `Title: ${input.post.title}`,
    `Body:\n${input.post.body ?? '(no body)'}`,
    ``,
    `# Classification`,
    JSON.stringify(input.classification, null, 2),
    ``,
    `# Subreddit policy`,
    JSON.stringify(input.policy, null, 2),
  ].join('\n');

  const result = (await callJSON({
    model: 'claude-sonnet-4-6',
    system: SYSTEM,
    user,
    maxTokens: 1024,
  })) as Draft;
  result.warnings = result.warnings ?? [];
  return result;
}

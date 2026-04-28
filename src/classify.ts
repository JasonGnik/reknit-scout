import { loadPrompt } from './config.js';
import { callJSON } from './anthropic.js';

const SYSTEM = loadPrompt('classify');

export type Classification = {
  intent: 'seeking_help' | 'venting' | 'sharing_progress' | 'asking_for_app' | 'off_topic';
  injury_type: string;
  stage: 'acute' | 'subacute' | 'chronic' | 'post_surgical' | 'unclear';
  fit_score: number;
  reasoning: string;
  risks: string[];
  red_flags: string[];
};

export async function classify(post: { subreddit: string; title: string; body: string | null }): Promise<Classification> {
  const user = `Subreddit: r/${post.subreddit}\n\nTitle: ${post.title}\n\nBody:\n${post.body ?? '(no body)'}`;
  const result = (await callJSON({
    model: 'claude-haiku-4-5-20251001',
    system: SYSTEM,
    user,
    maxTokens: 512,
  })) as Classification;
  // Defensive defaults.
  result.risks = result.risks ?? [];
  result.red_flags = result.red_flags ?? [];
  return result;
}

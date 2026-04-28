import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';

const client = new Anthropic({ apiKey: config.anthropicKey });

export async function callJSON(opts: {
  model: 'claude-haiku-4-5-20251001' | 'claude-sonnet-4-6';
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<unknown> {
  const res = await client.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 1024,
    system: opts.system,
    messages: [{ role: 'user', content: opts.user }],
  });
  const text = res.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { text: string }).text)
    .join('\n')
    .trim();
  // Strip markdown fences if model added them despite instructions.
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Model returned non-JSON: ${cleaned.slice(0, 200)}`);
  }
}

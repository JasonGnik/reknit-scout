import Snoowrap from 'snoowrap';
import { config } from './config.js';

export type RawPost = {
  id: string;
  subreddit: string;
  author: string;
  title: string;
  body: string;
  permalink: string;
  created_utc: number;
};

let _client: Snoowrap | null = null;

function client(): Snoowrap {
  if (_client) return _client;
  _client = new Snoowrap({
    userAgent: config.reddit.userAgent,
    clientId: config.reddit.clientId,
    clientSecret: config.reddit.clientSecret,
    username: config.reddit.username,
    password: config.reddit.password,
  });
  // Be a good API citizen.
  _client.config({ requestDelay: 1000, continueAfterRatelimitError: true, retryErrorCodes: [502, 503, 504, 522] });
  return _client;
}

export async function fetchRecent(subreddit: string, lookbackHours: number, limit = 100): Promise<RawPost[]> {
  const since = Date.now() / 1000 - lookbackHours * 3600;
  const sub = client().getSubreddit(subreddit);
  const posts = await sub.getNew({ limit });
  const out: RawPost[] = [];
  for (const p of posts) {
    if (p.created_utc < since) break;
    if (p.stickied || p.over_18) continue;
    out.push({
      id: `t3_${p.id}`,
      subreddit: p.subreddit.display_name,
      author: p.author?.name ?? '[deleted]',
      title: p.title,
      body: p.selftext ?? '',
      permalink: `https://www.reddit.com${p.permalink}`,
      created_utc: p.created_utc,
    });
  }
  return out;
}

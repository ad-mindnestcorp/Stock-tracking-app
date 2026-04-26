import axios from 'axios';
import { supabase } from '../lib/supabase';
import { POPULAR_SYMBOLS } from './finnhub.service';

const SUBREDDITS = ['wallstreetbets', 'stocks', 'investing', 'options', 'StockMarket'];
const SORT_TYPES = ['hot', 'new', 'rising'] as const;
const TOP_N = 20;
const POSTS_PER_FETCH = 50;

// Broad set of common English words / abbreviations that look like tickers but aren't
const WORD_BLACKLIST = new Set([
  'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER',
  'WAS', 'ONE', 'OUR', 'OUT', 'DAY', 'GET', 'HAS', 'HIM', 'HIS', 'HOW',
  'MAN', 'NEW', 'NOW', 'OLD', 'SEE', 'TWO', 'WAY', 'WHO', 'ITS', 'DID',
  'YES', 'HAD', 'LET', 'PUT', 'SAY', 'SHE', 'TOO', 'USE', 'IVE', 'IMO',
  'EPS', 'CEO', 'CFO', 'COO', 'IPO', 'ETF', 'NYSE', 'NASDAQ', 'SEC',
  'FED', 'GDP', 'CPI', 'ATH', 'ATL', 'YTD', 'EOD', 'EOY', 'QOQ', 'YOY',
  'DD', 'TA', 'PE', 'PB', 'EV', 'AI', 'ML', 'IT', 'US', 'UK', 'EU',
  'OP', 'OC', 'TL', 'DR', 'TIL', 'TLDR', 'LMAO', 'LOL', 'WTF', 'OMG',
  'EDIT', 'FWIW', 'AFAIK', 'IMO', 'IIRC', 'WSB', 'RH', 'SPY', 'QQQ',
  'LEAP', 'PUT', 'CALL', 'YOLO', 'HODL', 'ROTH', 'IRA', 'ETH', 'BTC',
  'NFT', 'APE', 'FOMO', 'DOGE', 'MOON', 'PUMP', 'DUMP', 'BEAR', 'BULL',
  'THIS', 'THAT', 'WITH', 'FROM', 'HAVE', 'WILL', 'BEEN', 'THEY', 'WHAT',
  'WHEN', 'WERE', 'THAN', 'THEN', 'ALSO', 'INTO', 'JUST', 'LIKE', 'MORE',
  'SOME', 'OVER', 'SUCH', 'EVEN', 'MUCH', 'MOST', 'VERY', 'BACK', 'GOOD',
  'LONG', 'LOOK', 'MAKE', 'MANY', 'ONLY', 'COME', 'DOES', 'DOWN', 'EACH',
  'FEEL', 'FIND', 'GIVE', 'GOES', 'HELP', 'HIGH', 'HOLD', 'HOPE', 'KEEP',
  'KNOW', 'LAST', 'LOSS', 'MADE', 'MEAN', 'NEED', 'NEXT', 'PLAN', 'PLAY',
  'RATE', 'REAL', 'RISK', 'SAID', 'SAME', 'SELL', 'SOLD', 'STAY', 'TAKE',
  'THEM', 'TIME', 'TOOK', 'TRUE', 'TURN', 'TYPE', 'WAIT', 'WANT', 'WEEK',
  'WELL', 'WENT', 'WORK', 'YEAR', 'YOUR', 'ZERO', 'CASH', 'COST', 'DEBT',
  'DEAL', 'DROP', 'FALL', 'GAIN', 'GROW', 'HUGE', 'HYPE', 'IDEA', 'JUST',
  'LOSS', 'MOVE', 'NEWS', 'OPEN', 'PAST', 'PEAK', 'PICK', 'POOR', 'RISE',
  'RUNS', 'SAFE', 'SAVE', 'SLOW', 'STOP', 'TERM', 'TOPS', 'TRADE', 'HUGE',
]);

const POSITIVE_WORDS = new Set(['buy', 'bullish', 'moon', 'breakout', 'long', 'calls', 'rally', 'upside', 'gains']);
const NEGATIVE_WORDS = new Set(['sell', 'bearish', 'crash', 'put', 'short', 'dump', 'drop', 'downside', 'losses']);

// Validated ticker set for O(1) lookup
const VALID_TICKERS = new Set(POPULAR_SYMBOLS);

const TICKER_REGEX = /\b([A-Z]{2,5})\b/g;

interface RedditPost {
  data: {
    id: string;
    title: string;
    selftext: string;
    score: number;
    num_comments: number;
    created_utc: number;
  };
}

interface RedditResponse {
  data: {
    children: RedditPost[];
  };
}

export interface TrendingStock {
  ticker: string;
  mentions: number;
  score: number;
  sentiment: number;
  trend: 'up' | 'down';
  rank: number;
  last_updated: string;
}

async function fetchSubredditPosts(
  subreddit: string,
  sort: typeof SORT_TYPES[number]
): Promise<RedditPost[]> {
  try {
    const res = await axios.get<RedditResponse>(
      `https://www.reddit.com/r/${subreddit}/${sort}.json`,
      {
        params: { limit: POSTS_PER_FETCH, raw_json: 1 },
        headers: {
          'User-Agent': 'StockvestApp/1.0 (stock tracking educational project)',
        },
        timeout: 10_000,
      }
    );
    return res.data?.data?.children ?? [];
  } catch (err) {
    console.error(`[reddit] Failed to fetch r/${subreddit}/${sort}:`, (err as Error).message);
    return [];
  }
}

function getRecencyBoost(createdUtc: number): number {
  const ageHours = (Date.now() / 1000 - createdUtc) / 3600;
  if (ageHours < 1) return 3.0;
  if (ageHours < 6) return 1.5;
  return 0.5;
}

function getSentimentScore(text: string): number {
  const lower = text.toLowerCase();
  const words = lower.split(/\W+/);
  let score = 0;
  for (const word of words) {
    if (POSITIVE_WORDS.has(word)) score += 1;
    if (NEGATIVE_WORDS.has(word)) score -= 1;
  }
  if (score > 0) return 1;
  if (score < 0) return -1;
  return 0;
}

function extractTickers(text: string): string[] {
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  TICKER_REGEX.lastIndex = 0;
  while ((match = TICKER_REGEX.exec(text)) !== null) {
    const word = match[1];
    if (!WORD_BLACKLIST.has(word) && VALID_TICKERS.has(word)) {
      matches.push(word);
    }
  }
  return matches;
}

interface TickerAggregates {
  mentions: number;
  totalUpvotes: number;
  totalComments: number;
  totalRecencyBoost: number;
  sentimentSum: number;
}

function aggregatePosts(posts: RedditPost[]): Map<string, TickerAggregates> {
  const sevenDaysAgo = Date.now() / 1000 - 7 * 24 * 60 * 60;
  const agg = new Map<string, TickerAggregates>();
  let skipped = 0;

  for (const post of posts) {
    if (post.data.created_utc < sevenDaysAgo) { skipped++; continue; }

    const text = `${post.data.title} ${post.data.selftext}`;
    const tickers = extractTickers(text);
    if (tickers.length === 0) continue;

    const recencyBoost = getRecencyBoost(post.data.created_utc);
    const sentiment = getSentimentScore(text);

    const uniqueTickers = [...new Set(tickers)];
    for (const ticker of uniqueTickers) {
      const existing = agg.get(ticker) ?? {
        mentions: 0,
        totalUpvotes: 0,
        totalComments: 0,
        totalRecencyBoost: 0,
        sentimentSum: 0,
      };
      existing.mentions += 1;
      existing.totalUpvotes += post.data.score;
      existing.totalComments += post.data.num_comments;
      existing.totalRecencyBoost += recencyBoost;
      existing.sentimentSum += sentiment;
      agg.set(ticker, existing);
    }
  }

  if (skipped > 0) {
    console.log(`[reddit] Skipped ${skipped} posts older than 7 days.`);
  }

  return agg;
}

function computeScore(agg: TickerAggregates): number {
  const avgSentiment = agg.sentimentSum / agg.mentions;
  return (
    agg.mentions * 1.0 +
    agg.totalUpvotes * 0.2 +
    agg.totalComments * 0.3 +
    agg.totalRecencyBoost * 1.5 +
    avgSentiment * 2.0
  );
}

/** Fetch posts from all subreddits (hot + new + rising), score, and upsert top results to Supabase. */
export async function refreshTrendingStocks(): Promise<void> {
  console.log('[reddit] Refreshing trending stocks...');

  // Fetch all combinations in parallel
  const fetchPromises = SUBREDDITS.flatMap((sub) =>
    SORT_TYPES.map((sort) => fetchSubredditPosts(sub, sort))
  );
  const postArrays = await Promise.all(fetchPromises);
  const allPosts = postArrays.flat();

  // Deduplicate by post ID
  const seen = new Set<string>();
  const uniquePosts = allPosts.filter((p) => {
    if (seen.has(p.data.id)) return false;
    seen.add(p.data.id);
    return true;
  });

  console.log(`[reddit] ${allPosts.length} total posts → ${uniquePosts.length} unique after dedup`);

  const aggregates = aggregatePosts(uniquePosts);

  const ranked = [...aggregates.entries()]
    .map(([ticker, agg]) => {
      const score = computeScore(agg);
      const avgSentiment = agg.sentimentSum / agg.mentions;
      return {
        ticker,
        mentions: agg.mentions,
        score: Math.round(score * 100) / 100,
        sentiment: Math.round(avgSentiment * 100) / 100,
        trend: (avgSentiment >= 0 ? 'up' : 'down') as 'up' | 'down',
        last_updated: new Date().toISOString(),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  if (ranked.length === 0) {
    console.warn('[reddit] No tickers found — skipping upsert.');
    return;
  }

  console.log('[reddit] Top ranked tickers:');
  ranked.forEach(({ rank, ticker, mentions, score, sentiment }) => {
    console.log(
      `  #${rank} ${ticker} — ${mentions} mention${mentions !== 1 ? 's' : ''}, score: ${score}, sentiment: ${sentiment}`
    );
  });

  const { error } = await supabase
    .from('trending_stocks')
    .upsert(ranked, { onConflict: 'ticker' });

  if (error) {
    console.error('[reddit] Supabase upsert error:', error.message);
  } else {
    console.log(`[reddit] Upserted ${ranked.length} trending stocks.`);
  }
}

/** Read cached trending stocks from Supabase, ordered by rank. */
export async function getTrendingStocks(): Promise<TrendingStock[]> {
  const { data, error } = await supabase
    .from('trending_stocks')
    .select('ticker, mentions, score, sentiment, trend, rank, last_updated')
    .order('rank', { ascending: true })
    .limit(TOP_N);

  if (error) {
    console.error('[reddit] Supabase read error:', error.message);
    return [];
  }

  return (data ?? []) as TrendingStock[];
}

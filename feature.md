# 📈 Feature: Trending Stocks from Reddit

## 1. Overview

This feature identifies **trending stocks** by analyzing discussions on Reddit.
It collects posts from selected subreddits, extracts stock ticker symbols, and ranks them based on activity, sentiment, and recency.

---

## 2. How It Works (Simple Explanation)

1. Fetch recent posts from Reddit (not just “hot”, include “new” and “rising”).
2. Extract stock ticker symbols from post titles, descriptions, and comments.
3. Count how often each ticker appears.
4. Apply scoring based on:

   * Mentions
   * Upvotes
   * Comments
   * Recency
   * Sentiment
5. Rank stocks by score.
6. Return top trending stocks.

---

## 3. Data Required

### From Reddit API:

* Post title
* Post body (selftext)
* Upvotes (score)
* Number of comments
* Created timestamp
* Top comments (optional but recommended)

### Subreddits to Track:

* wallstreetbets
* stocks
* investing
* options
* StockMarket

---

## 4. Ticker Extraction Logic

* Extract words in formats:

  * `$TSLA`
  * `TSLA`
* Match only valid stock tickers (use whitelist from API or static list)
* Ignore common English words (e.g., IT, FOR, ALL)

---

## 5. Sentiment Analysis (Simple)

Use keyword-based scoring:

### Positive words:

* buy, bullish, moon, breakout, long

### Negative words:

* sell, bearish, crash, put, short

### Output:

* +1 → positive
* 0 → neutral
* -1 → negative

---

## 6. Scoring System

For each ticker:

Score =
(Mentions × 1.0) +
(Upvotes × 0.2) +
(Comments × 0.3) +
(Recency Boost × 1.5) +
(Sentiment Score × 2.0)

---

## 7. Recency Boost

* Newer posts should have higher weight
* Example:

  * < 1 hour → high boost
  * 1–6 hours → medium
  * > 6 hours → low

---

## 8. Backend Implementation Steps

1. Create a scheduler (run every 5–10 minutes)
2. Fetch:

   * 50 new posts
   * 50 rising posts
   * 50 top posts (last few hours)
3. Parse posts and comments
4. Extract tickers
5. Calculate:

   * mentions
   * sentiment
   * engagement (upvotes, comments)
6. Compute score
7. Store results in database
8. Expose API endpoint:

   * GET /trending-stocks

---

## 9. API Response Format

```json
[
  {
    "ticker": "TSLA",
    "score": 92,
    "mentions": 50,
    "sentiment": 0.75,
    "trend": "up"
  }
]
```

---

## 10. UI Requirements

### Display:

* List of trending stocks

### Each item should show:

* Ticker symbol
* Trending score
* Number of mentions
* Sentiment (positive/negative indicator)
* Trend arrow (up/down)

### Optional:

* Refresh button
* Last updated timestamp

---

## 11. Performance Notes

* Cache results (Redis recommended)
* Avoid repeated Reddit API calls
* Limit posts per request (avoid heavy load)

---

## 12. Future Improvements (Optional)

* Use LLM for better sentiment analysis
* Add stock price + volume data (Finnhub/Yahoo Finance)
* Detect sudden spikes (trend acceleration)
* Filter spam or duplicate posts

---

## ✅ Goal

Provide users with a **real-time, reliable list of trending stocks based on Reddit discussions**, combining social sentiment and engagement signals.

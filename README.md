# Pulse - Crypto Flow Tracker

A real-time cryptocurrency tracking dashboard that analyzes inflows, outflows, volume, and social sentiment to identify potential trading opportunities.

## Features

- **Live Price Data** - Real-time prices from CoinGecko API
- **Flow Analysis** - Track inflows and outflows for each coin
- **Social Sentiment** - X (Twitter) and Reddit mention tracking with sentiment analysis
- **Signal Scoring** - Composite 0-100 score combining flow, volume, trend, and social data
- **Detailed Coin View** - Click any coin for comprehensive analysis
- **Direct Links** - Quick access to CoinMarketCap and CoinGecko pages

## Signal Scoring Methodology

| Component | Max Points | Description |
|-----------|------------|-------------|
| Flow Dynamics | 35pts | Positive net flows indicate accumulation |
| Volume & Price | 25pts | Rising volume with price confirms momentum |
| 7d Trend | 20pts | Weekly trend confirms sustained interest |
| Social Sentiment | 20pts | X + Reddit chatter with positive sentiment |

## Tech Stack

- React 18
- Vite
- CoinGecko API (free tier)

## Getting Started

```bash
npm install
npm run dev
```

## Deployment

This project is configured for Vercel deployment. Connect your GitHub repo to Vercel and it will auto-deploy.

## License

MIT

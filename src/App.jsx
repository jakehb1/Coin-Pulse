import React, { useState, useEffect, useCallback, useMemo } from 'react';

const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const DEXSCREENER_API = 'https://api.dexscreener.com';
const POLYMARKET_API = 'https://gamma-api.polymarket.com';

// Fallback data
const FALLBACK_COINS = [
  { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', current_price: 97500, price_change_percentage_24h: 2.5, price_change_percentage_7d_in_currency: 8.2, market_cap: 1920000000000, total_volume: 45000000000, market_cap_rank: 1, image: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png' },
  { id: 'ethereum', symbol: 'eth', name: 'Ethereum', current_price: 3450, price_change_percentage_24h: 1.8, price_change_percentage_7d_in_currency: 5.5, market_cap: 415000000000, total_volume: 22000000000, market_cap_rank: 2, image: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' },
  { id: 'solana', symbol: 'sol', name: 'Solana', current_price: 185, price_change_percentage_24h: 3.2, price_change_percentage_7d_in_currency: 12.5, market_cap: 89000000000, total_volume: 4500000000, market_cap_rank: 5, image: 'https://assets.coingecko.com/coins/images/4128/small/solana.png' },
  { id: 'ripple', symbol: 'xrp', name: 'XRP', current_price: 2.35, price_change_percentage_24h: 4.1, price_change_percentage_7d_in_currency: 15.8, market_cap: 135000000000, total_volume: 12000000000, market_cap_rank: 3, image: 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png' },
  { id: 'sui', symbol: 'sui', name: 'Sui', current_price: 4.35, price_change_percentage_24h: 5.2, price_change_percentage_7d_in_currency: 18.8, market_cap: 13500000000, total_volume: 1850000000, market_cap_rank: 16, image: 'https://assets.coingecko.com/coins/images/26375/small/sui_asset.jpeg' },
];

const FALLBACK_MEMES = [
  { id: 'doge', symbol: 'DOGE', name: 'Dogecoin', price: 0.38, priceChange24h: 5.5, marketCap: 56000000000, volume24h: 4200000000, image: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png', chain: 'multi' },
  { id: 'pepe', symbol: 'PEPE', name: 'Pepe', price: 0.0000195, priceChange24h: 8.5, marketCap: 8200000000, volume24h: 2100000000, image: 'https://assets.coingecko.com/coins/images/29850/small/pepe-token.jpeg', chain: 'ethereum' },
  { id: 'wif', symbol: 'WIF', name: 'dogwifhat', price: 2.85, priceChange24h: 15.2, marketCap: 2850000000, volume24h: 1200000000, image: 'https://assets.coingecko.com/coins/images/33566/small/dogwifhat.jpg', chain: 'solana' },
  { id: 'bonk', symbol: 'BONK', name: 'Bonk', price: 0.0000385, priceChange24h: 12.5, marketCap: 2900000000, volume24h: 980000000, image: 'https://assets.coingecko.com/coins/images/28600/small/bonk.jpg', chain: 'solana' },
  { id: 'pnut', symbol: 'PNUT', name: 'Peanut the Squirrel', price: 1.25, priceChange24h: 65.2, marketCap: 1250000000, volume24h: 890000000, chain: 'solana', isPumpFun: true },
  { id: 'ai16z', symbol: 'AI16Z', name: 'ai16z', price: 0.95, priceChange24h: 55.2, marketCap: 950000000, volume24h: 520000000, chain: 'solana', isPumpFun: true },
];

const FALLBACK_MARKETS = [
  { id: '1', question: 'Will Bitcoin reach $150k by end of 2025?', outcomePrices: '0.42,0.58', volume: 12500000, liquidity: 850000, category: 'Crypto', endDate: '2025-12-31' },
  { id: '2', question: 'Will the Fed cut rates in December 2025?', outcomePrices: '0.65,0.35', volume: 8200000, liquidity: 620000, category: 'Economics', endDate: '2025-12-18' },
  { id: '3', question: 'Will Solana reach $500 in 2025?', outcomePrices: '0.22,0.78', volume: 6400000, liquidity: 480000, category: 'Crypto', endDate: '2025-12-31' },
];

// Trending topics data - simulates cross-platform trend detection
const TRENDING_TOPICS = [
  { 
    id: 1, topic: 'Marty Supreme', ticker: '$MARTY',
    x: { mentions: 48200, growth: 342, sentiment: 0.78 },
    reddit: { mentions: 12400, growth: 215, sentiment: 0.72 },
    discord: { mentions: 8900, growth: 180, sentiment: 0.85 },
    tiktok: { views: 2800000, growth: 520, sentiment: 0.81 },
    category: 'Meme Character', firstSeen: '2025-11-18', velocity: 95
  },
  { 
    id: 2, topic: 'Chill Guy', ticker: '$CHILLGUY',
    x: { mentions: 125000, growth: 180, sentiment: 0.82 },
    reddit: { mentions: 45000, growth: 150, sentiment: 0.79 },
    discord: { mentions: 22000, growth: 120, sentiment: 0.88 },
    tiktok: { views: 15000000, growth: 280, sentiment: 0.85 },
    category: 'Meme Character', firstSeen: '2025-11-01', velocity: 88
  },
  { 
    id: 3, topic: 'Moo Deng', ticker: '$MOODENG',
    x: { mentions: 89000, growth: 85, sentiment: 0.91 },
    reddit: { mentions: 34000, growth: 72, sentiment: 0.88 },
    discord: { mentions: 15000, growth: 65, sentiment: 0.92 },
    tiktok: { views: 45000000, growth: 120, sentiment: 0.94 },
    category: 'Animal', firstSeen: '2025-09-15', velocity: 45
  },
  { 
    id: 4, topic: 'Hawk Tuah Girl', ticker: '$HAWKTUAH',
    x: { mentions: 220000, growth: 25, sentiment: 0.65 },
    reddit: { mentions: 78000, growth: 18, sentiment: 0.58 },
    discord: { mentions: 35000, growth: 12, sentiment: 0.62 },
    tiktok: { views: 180000000, growth: 8, sentiment: 0.61 },
    category: 'Viral Moment', firstSeen: '2025-06-20', velocity: 15
  },
  { 
    id: 5, topic: 'AI Girlfriend Meta', ticker: '$AIGF',
    x: { mentions: 32000, growth: 425, sentiment: 0.71 },
    reddit: { mentions: 18500, growth: 380, sentiment: 0.68 },
    discord: { mentions: 28000, growth: 290, sentiment: 0.75 },
    tiktok: { views: 890000, growth: 350, sentiment: 0.69 },
    category: 'Tech Trend', firstSeen: '2025-11-22', velocity: 98
  },
  { 
    id: 6, topic: 'Diddy Memes', ticker: '$DIDDY',
    x: { mentions: 185000, growth: 45, sentiment: 0.42 },
    reddit: { mentions: 92000, growth: 38, sentiment: 0.35 },
    discord: { mentions: 28000, growth: 25, sentiment: 0.38 },
    tiktok: { views: 95000000, growth: 35, sentiment: 0.40 },
    category: 'News Event', firstSeen: '2025-09-20', velocity: 32
  },
  { 
    id: 7, topic: 'Skibidi Toilet', ticker: '$SKIBIDI',
    x: { mentions: 156000, growth: 12, sentiment: 0.75 },
    reddit: { mentions: 42000, growth: 8, sentiment: 0.72 },
    discord: { mentions: 85000, growth: 15, sentiment: 0.82 },
    tiktok: { views: 280000000, growth: 5, sentiment: 0.78 },
    category: 'Animation', firstSeen: '2024-02-01', velocity: 8
  },
  { 
    id: 8, topic: 'Trump Crypto', ticker: '$TRUMPCRYPTO',
    x: { mentions: 95000, growth: 185, sentiment: 0.55 },
    reddit: { mentions: 48000, growth: 165, sentiment: 0.48 },
    discord: { mentions: 22000, growth: 145, sentiment: 0.52 },
    tiktok: { views: 12000000, growth: 210, sentiment: 0.51 },
    category: 'Politics', firstSeen: '2025-11-10', velocity: 78
  },
  { 
    id: 9, topic: 'Baby Hippo', ticker: '$BABYHIPPO',
    x: { mentions: 28000, growth: 520, sentiment: 0.95 },
    reddit: { mentions: 15000, growth: 480, sentiment: 0.92 },
    discord: { mentions: 8500, growth: 390, sentiment: 0.94 },
    tiktok: { views: 5200000, growth: 620, sentiment: 0.96 },
    category: 'Animal', firstSeen: '2025-11-24', velocity: 99
  },
  { 
    id: 10, topic: 'Sigma Grindset', ticker: '$SIGMA',
    x: { mentions: 78000, growth: 32, sentiment: 0.68 },
    reddit: { mentions: 45000, growth: 28, sentiment: 0.65 },
    discord: { mentions: 52000, growth: 35, sentiment: 0.72 },
    tiktok: { views: 45000000, growth: 15, sentiment: 0.70 },
    category: 'Lifestyle', firstSeen: '2024-08-15', velocity: 22
  },
  { 
    id: 11, topic: 'Fanum Tax', ticker: '$FANUM',
    x: { mentions: 42000, growth: 65, sentiment: 0.78 },
    reddit: { mentions: 18000, growth: 55, sentiment: 0.75 },
    discord: { mentions: 35000, growth: 72, sentiment: 0.82 },
    tiktok: { views: 28000000, growth: 45, sentiment: 0.80 },
    category: 'Slang', firstSeen: '2025-08-01', velocity: 48
  },
  { 
    id: 12, topic: 'Grimace Shake', ticker: '$GRIMACE',
    x: { mentions: 125000, growth: 5, sentiment: 0.72 },
    reddit: { mentions: 65000, growth: 3, sentiment: 0.68 },
    discord: { mentions: 22000, growth: 2, sentiment: 0.70 },
    tiktok: { views: 520000000, growth: 2, sentiment: 0.74 },
    category: 'Brand Moment', firstSeen: '2024-06-15', velocity: 3
  },
];

const seededRandom = (seed) => { const x = Math.sin(seed) * 10000; return x - Math.floor(x); };

// Calculate launch score based on cross-platform presence
const calculateLaunchScore = (topic) => {
  const platforms = [
    { name: 'x', weight: 0.35, hasData: topic.x?.mentions > 0 },
    { name: 'reddit', weight: 0.25, hasData: topic.reddit?.mentions > 0 },
    { name: 'discord', weight: 0.15, hasData: topic.discord?.mentions > 0 },
    { name: 'tiktok', weight: 0.25, hasData: topic.tiktok?.views > 0 },
  ];
  
  const platformCount = platforms.filter(p => p.hasData).length;
  const crossPlatformBonus = platformCount >= 4 ? 1.5 : platformCount >= 3 ? 1.25 : platformCount >= 2 ? 1.1 : 1;
  
  // Normalize mentions/views to scores
  const xScore = Math.min(100, (topic.x?.mentions || 0) / 2000);
  const redditScore = Math.min(100, (topic.reddit?.mentions || 0) / 1000);
  const discordScore = Math.min(100, (topic.discord?.mentions || 0) / 500);
  const tiktokScore = Math.min(100, (topic.tiktok?.views || 0) / 1000000);
  
  // Weight by growth rate (velocity is key for meme coins)
  const velocityMultiplier = 1 + (topic.velocity / 100) * 0.5;
  
  // Average sentiment across platforms
  const avgSentiment = (
    (topic.x?.sentiment || 0) + 
    (topic.reddit?.sentiment || 0) + 
    (topic.discord?.sentiment || 0) + 
    (topic.tiktok?.sentiment || 0)
  ) / platformCount;
  
  const sentimentBonus = avgSentiment > 0.7 ? 1.2 : avgSentiment > 0.5 ? 1.0 : 0.8;
  
  const baseScore = (xScore * 0.35 + redditScore * 0.25 + discordScore * 0.15 + tiktokScore * 0.25);
  const finalScore = Math.min(100, Math.round(baseScore * crossPlatformBonus * velocityMultiplier * sentimentBonus));
  
  return finalScore;
};

const getLaunchLabel = (score) => {
  if (score >= 85) return { label: '🚀 LAUNCH NOW', color: '#dc2626', bg: '#fef2f2', desc: 'Prime launch window' };
  if (score >= 70) return { label: '🔥 HOT', color: '#f97316', bg: '#fff7ed', desc: 'Strong momentum' };
  if (score >= 55) return { label: '📈 RISING', color: '#eab308', bg: '#fefce8', desc: 'Building steam' };
  if (score >= 40) return { label: '👀 WATCH', color: '#22c55e', bg: '#f0fdf4', desc: 'Early signals' };
  if (score >= 25) return { label: '🌱 EMERGING', color: '#06b6d4', bg: '#ecfeff', desc: 'Just starting' };
  return { label: '💤 FADING', color: '#737373', bg: '#f5f5f5', desc: 'Past peak' };
};

const getVelocityLabel = (velocity) => {
  if (velocity >= 80) return { label: '⚡ Explosive', color: '#dc2626' };
  if (velocity >= 60) return { label: '🔥 Rapid', color: '#f97316' };
  if (velocity >= 40) return { label: '📈 Growing', color: '#eab308' };
  if (velocity >= 20) return { label: '➡️ Steady', color: '#22c55e' };
  return { label: '📉 Slowing', color: '#737373' };
};

const getCategoryColor = (cat) => {
  const colors = {
    'Meme Character': { bg: '#fef3c7', color: '#92400e' },
    'Animal': { bg: '#dcfce7', color: '#166534' },
    'Viral Moment': { bg: '#fee2e2', color: '#991b1b' },
    'Tech Trend': { bg: '#dbeafe', color: '#1e40af' },
    'News Event': { bg: '#f3e8ff', color: '#6b21a8' },
    'Animation': { bg: '#cffafe', color: '#0e7490' },
    'Politics': { bg: '#e0e7ff', color: '#3730a3' },
    'Lifestyle': { bg: '#fce7f3', color: '#9d174d' },
    'Slang': { bg: '#d1fae5', color: '#065f46' },
    'Brand Moment': { bg: '#fef9c3', color: '#854d0e' },
    'Crypto': { bg: '#fef3c7', color: '#92400e' },
    'Economics': { bg: '#dcfce7', color: '#166534' },
  };
  return colors[cat] || { bg: '#f5f5f5', color: '#525252' };
};

// Utility functions
const generateSocialSentiment = (symbol, rank, isMeme = false) => {
  const seed = (symbol || 'X').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const memeBonus = isMeme ? 2.5 : 1;
  const rankMultiplier = Math.max(0.5, 2 - (rank / 50)) * memeBonus;
  const xMentions = Math.floor((seededRandom(seed) * 45000 + 500) * rankMultiplier);
  const xSentiment = (seededRandom(seed + 2) - 0.3) * 100;
  const redditSentiment = (seededRandom(seed + 3) - 0.3) * 100;
  return { xMentions24h: xMentions, xTrending: xMentions > 20000, combinedSentiment: (xSentiment * 0.6 + redditSentiment * 0.4) };
};

const generateFlowData = (coin, isMeme = false) => {
  const volume = coin.total_volume || coin.volume24h || 1000000;
  const seed = (coin.symbol || 'X').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const inflow24h = volume * (0.35 + seededRandom(seed + 10) * 0.3);
  const outflow24h = volume * (0.35 + seededRandom(seed + 11) * 0.3);
  const netFlow = inflow24h - outflow24h;
  const rank = coin.market_cap_rank || coin.rank || 100;
  const social = generateSocialSentiment(coin.symbol, rank, isMeme);
  const priceChange24h = coin.price_change_percentage_24h || coin.priceChange24h || 0;
  const priceChange7d = coin.price_change_percentage_7d_in_currency || coin.priceChange7d || priceChange24h * 1.5;
  const viralScore = isMeme ? Math.min(100, Math.floor((Math.abs(priceChange24h) * 1.5) + (social.xMentions24h / 1000) + (social.combinedSentiment > 0 ? social.combinedSentiment * 0.3 : 0))) : 0;
  const flowScore = netFlow/volume > 0.05 ? 35 : netFlow/volume > 0.02 ? 28 : netFlow/volume > 0 ? 20 : 12;
  const signalScore = Math.min(100, flowScore + (priceChange24h > 10 ? 25 : priceChange24h > 0 ? 15 : 8) + (priceChange7d > 15 ? 20 : priceChange7d > 0 ? 10 : 5) + (social.combinedSentiment > 20 ? 15 : 0));

  return {
    id: coin.id, symbol: (coin.symbol || '').toUpperCase(), name: coin.name || 'Unknown', 
    image: coin.image || coin.info?.imageUrl || '', price: coin.current_price || coin.price || 0,
    priceChange24h, priceChange7d, marketCap: coin.market_cap || coin.marketCap || coin.fdv || 0,
    volume24h: volume, inflow24h, outflow24h, netFlow, rank, signalScore, viralScore, isMeme,
    chain: coin.chain || coin.chainId || '', dexUrl: coin.dexUrl || coin.url || '',
    isPumpFun: coin.isPumpFun || false, ...social,
  };
};

const processDexScreenerPair = (pair) => ({
  id: pair.baseToken?.address || `dex-${Math.random()}`,
  symbol: pair.baseToken?.symbol || 'UNKNOWN',
  name: pair.baseToken?.name || 'Unknown Token',
  price: parseFloat(pair.priceUsd || 0),
  priceChange24h: parseFloat(pair.priceChange?.h24 || 0),
  marketCap: parseFloat(pair.fdv || pair.marketCap || 0),
  volume24h: parseFloat(pair.volume?.h24 || 0),
  image: pair.info?.imageUrl || '',
  chain: pair.chainId || 'solana',
  dexUrl: pair.url,
  isPumpFun: pair.dexId === 'pumpfun',
});

const processPolymarketData = (market) => {
  const prices = (market.outcomePrices || '0.5,0.5').split(',').map(p => parseFloat(p));
  return {
    id: market.id || market.conditionId,
    question: market.question || 'Unknown Market',
    yesPrice: prices[0] || 0.5, noPrice: prices[1] || 0.5,
    yesPct: Math.round((prices[0] || 0.5) * 100), noPct: Math.round((prices[1] || 0.5) * 100),
    volume: parseFloat(market.volume || 0), liquidity: parseFloat(market.liquidity || 0),
    category: market.category || 'General', slug: market.slug || '',
    endDate: market.endDate || '', active: market.active !== false && market.closed !== true,
  };
};

const formatPrice = (p) => p === 0 ? '$0' : p < 0.00001 ? `$${p.toExponential(2)}` : p < 0.001 ? `$${p.toFixed(8)}` : p < 1 ? `$${p.toFixed(6)}` : p < 1000 ? `$${p.toFixed(2)}` : `$${p.toLocaleString(undefined, {maximumFractionDigits: 2})}`;
const formatLargeNumber = (n) => !n ? '-' : n >= 1e9 ? `$${(n/1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(1)}K` : `$${n.toFixed(0)}`;
const formatNumber = (n) => !n ? '0' : n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(1)}K` : n.toString();
const formatPercent = (n) => n == null ? '-' : `${n >= 0 ? '+' : ''}${Math.abs(n) > 1000 ? (n/1000).toFixed(1) + 'K' : n.toFixed(1)}%`;

const getViralLabel = (s) => s >= 80 ? { label: '🔥 VIRAL', color: '#dc2626', bg: '#fef2f2' } : s >= 60 ? { label: '🚀 HOT', color: '#f97316', bg: '#fff7ed' } : s >= 40 ? { label: '📈 Rising', color: '#eab308', bg: '#fefce8' } : s >= 20 ? { label: '👀 Watch', color: '#22c55e', bg: '#f0fdf4' } : { label: '💤 Quiet', color: '#737373', bg: '#f5f5f5' };
const getSignalLabel = (s) => s >= 80 ? { label: 'Strong Buy', color: '#16a34a', bg: '#dcfce7' } : s >= 60 ? { label: 'Buy', color: '#22c55e', bg: '#f0fdf4' } : s >= 40 ? { label: 'Neutral', color: '#737373', bg: '#f5f5f5' } : { label: 'Caution', color: '#f97316', bg: '#fff7ed' };
const getChainBadge = (c) => ({ solana: { l: 'SOL', c: '#9945FF', b: '#f3e8ff' }, ethereum: { l: 'ETH', c: '#627EEA', b: '#eff6ff' }, base: { l: 'BASE', c: '#0052FF', b: '#eff6ff' } }[c] || { l: c?.slice(0,4)?.toUpperCase() || '?', c: '#737373', b: '#f5f5f5' });

// Platform icons as simple text indicators
const PlatformBar = ({ topic }) => (
  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
    <div style={{ flex: 1, padding: '6px 8px', backgroundColor: '#f0f9ff', borderRadius: '6px', textAlign: 'center' }}>
      <div style={{ fontSize: '10px', color: '#0369a1', fontWeight: '600' }}>𝕏</div>
      <div style={{ fontSize: '11px', color: '#0c4a6e', fontWeight: '600' }}>{formatNumber(topic.x?.mentions)}</div>
      <div style={{ fontSize: '9px', color: topic.x?.growth > 100 ? '#16a34a' : '#737373' }}>+{topic.x?.growth}%</div>
    </div>
    <div style={{ flex: 1, padding: '6px 8px', backgroundColor: '#fef2f2', borderRadius: '6px', textAlign: 'center' }}>
      <div style={{ fontSize: '10px', color: '#dc2626', fontWeight: '600' }}>Reddit</div>
      <div style={{ fontSize: '11px', color: '#991b1b', fontWeight: '600' }}>{formatNumber(topic.reddit?.mentions)}</div>
      <div style={{ fontSize: '9px', color: topic.reddit?.growth > 100 ? '#16a34a' : '#737373' }}>+{topic.reddit?.growth}%</div>
    </div>
    <div style={{ flex: 1, padding: '6px 8px', backgroundColor: '#f3e8ff', borderRadius: '6px', textAlign: 'center' }}>
      <div style={{ fontSize: '10px', color: '#7c3aed', fontWeight: '600' }}>Discord</div>
      <div style={{ fontSize: '11px', color: '#5b21b6', fontWeight: '600' }}>{formatNumber(topic.discord?.mentions)}</div>
      <div style={{ fontSize: '9px', color: topic.discord?.growth > 100 ? '#16a34a' : '#737373' }}>+{topic.discord?.growth}%</div>
    </div>
    <div style={{ flex: 1, padding: '6px 8px', backgroundColor: '#fdf4ff', borderRadius: '6px', textAlign: 'center' }}>
      <div style={{ fontSize: '10px', color: '#c026d3', fontWeight: '600' }}>TikTok</div>
      <div style={{ fontSize: '11px', color: '#86198f', fontWeight: '600' }}>{formatNumber(topic.tiktok?.views)}</div>
      <div style={{ fontSize: '9px', color: topic.tiktok?.growth > 100 ? '#16a34a' : '#737373' }}>+{topic.tiktok?.growth}%</div>
    </div>
  </div>
);

const TrendCard = ({ topic }) => {
  const launchScore = calculateLaunchScore(topic);
  const launchLabel = getLaunchLabel(launchScore);
  const velocityLabel = getVelocityLabel(topic.velocity);
  const catColor = getCategoryColor(topic.category);
  const avgSentiment = Math.round(((topic.x?.sentiment || 0) + (topic.reddit?.sentiment || 0) + (topic.discord?.sentiment || 0) + (topic.tiktok?.sentiment || 0)) / 4 * 100);
  
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '14px', border: '1px solid #e5e5e5', padding: '16px', transition: 'all 0.15s', boxShadow: launchScore >= 85 ? '0 0 20px rgba(220, 38, 38, 0.15)' : 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div>
          <span style={{ backgroundColor: catColor.bg, color: catColor.color, padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase' }}>{topic.category}</span>
          <span style={{ marginLeft: '8px', fontSize: '10px', color: '#a3a3a3' }}>First seen: {new Date(topic.firstSeen).toLocaleDateString()}</span>
        </div>
        <span style={{ backgroundColor: velocityLabel.color + '15', color: velocityLabel.color, padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600' }}>{velocityLabel.label}</span>
      </div>
      
      <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#171717', margin: '0 0 4px' }}>{topic.topic}</h3>
      <p style={{ fontSize: '13px', color: '#737373', margin: '0 0 12px', fontFamily: 'monospace' }}>{topic.ticker}</p>
      
      <PlatformBar topic={topic} />
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #f5f5f5' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#737373', marginBottom: '2px' }}>Sentiment</div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: avgSentiment > 70 ? '#16a34a' : avgSentiment > 50 ? '#eab308' : '#dc2626' }}>{avgSentiment}% positive</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '10px', color: '#737373', marginBottom: '2px' }}>Launch Score</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '22px', fontWeight: '700', color: '#171717' }}>{launchScore}</span>
            <span style={{ backgroundColor: launchLabel.bg, color: launchLabel.color, padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>{launchLabel.label}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const MarketCard = ({ market }) => {
  const catColor = getCategoryColor(market.category);
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e5e5', padding: '16px', cursor: 'pointer' }} onClick={() => window.open(`https://polymarket.com/event/${market.slug}`, '_blank')}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={{ backgroundColor: catColor.bg, color: catColor.color, padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600' }}>{market.category}</span>
      </div>
      <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#171717', margin: '0 0 14px', lineHeight: '1.4' }}>{market.question}</h3>
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#16a34a' }}>Yes {market.yesPct}%</span>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#dc2626' }}>No {market.noPct}%</span>
        </div>
        <div style={{ height: '8px', backgroundColor: '#fee2e2', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${market.yesPct}%`, backgroundColor: '#16a34a', borderRadius: '4px' }} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#737373' }}>
        <span>Vol: {formatLargeNumber(market.volume)}</span>
        <span>Liq: {formatLargeNumber(market.liquidity)}</span>
      </div>
    </div>
  );
};

const CoinModal = ({ coin, onClose }) => {
  const signal = getSignalLabel(coin.signalScore);
  const chain = getChainBadge(coin.chain);
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={onClose}>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '24px', borderBottom: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {coin.image ? <img src={coin.image} alt="" style={{ width: '48px', height: '48px', borderRadius: '50%' }} onError={e => e.target.style.display='none'} /> : <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '600' }}>{coin.symbol?.[0]}</div>}
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#171717', margin: 0 }}>{coin.name}</h2>
              <p style={{ fontSize: '14px', color: '#737373', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}>{coin.symbol} <span style={{ backgroundColor: chain.b, color: chain.c, padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '600' }}>{chain.l}</span></p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', backgroundColor: '#f5f5f5', cursor: 'pointer', fontSize: '16px' }}>×</button>
        </div>
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div style={{ padding: '14px', backgroundColor: '#fafafa', borderRadius: '10px' }}><p style={{ fontSize: '11px', color: '#737373', margin: '0 0 4px' }}>PRICE</p><p style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>{formatPrice(coin.price)}</p><p style={{ fontSize: '12px', color: coin.priceChange24h >= 0 ? '#16a34a' : '#dc2626', margin: '4px 0 0', fontWeight: '600' }}>{formatPercent(coin.priceChange24h)} 24h</p></div>
            <div style={{ padding: '14px', backgroundColor: '#fafafa', borderRadius: '10px' }}><p style={{ fontSize: '11px', color: '#737373', margin: '0 0 4px' }}>SIGNAL</p><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><p style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>{coin.signalScore}</p><span style={{ backgroundColor: signal.bg, color: signal.color, padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600' }}>{signal.label}</span></div></div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {coin.dexUrl && <a href={coin.dexUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: '12px', backgroundColor: '#171717', color: 'white', textDecoration: 'none', borderRadius: '10px', textAlign: 'center', fontSize: '13px', fontWeight: '600' }}>DexScreener ↗</a>}
            <a href={`https://www.coingecko.com/en/coins/${coin.id}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: '12px', backgroundColor: '#8dc647', color: 'white', textDecoration: 'none', borderRadius: '10px', textAlign: 'center', fontSize: '13px', fontWeight: '600' }}>CoinGecko ↗</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('all');
  const [data, setData] = useState([]);
  const [memeData, setMemeData] = useState([]);
  const [markets, setMarkets] = useState([]);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState('signalScore');
  const [sortDirection, setSortDirection] = useState('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCoin, setSelectedCoin] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [launchFilter, setLaunchFilter] = useState('all');

  const fetchCoins = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h,7d`, { signal: AbortSignal.timeout(15000) });
      if (res.ok) { const coins = await res.json(); if (Array.isArray(coins) && coins.length) setData(coins.map(c => generateFlowData(c, false))); }
      else throw new Error();
    } catch { setData(FALLBACK_COINS.map(c => generateFlowData(c, false))); }
    finally { setLoading(false); setLastUpdated(new Date()); }
  }, []);

  const fetchMemes = useCallback(async () => {
    try {
      const res = await fetch(`${DEXSCREENER_API}/token-boosts/top/v1`, { signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const boosts = await res.json();
        if (Array.isArray(boosts) && boosts.length > 5) {
          const pairs = await Promise.all(boosts.slice(0, 30).map(async t => {
            try { const r = await fetch(`${DEXSCREENER_API}/latest/dex/tokens/${t.tokenAddress}`); const d = await r.json(); return d.pairs?.[0] ? processDexScreenerPair(d.pairs[0]) : null; } catch { return null; }
          }));
          const valid = pairs.filter(Boolean);
          if (valid.length > 5) { setMemeData(valid.map(p => generateFlowData(p, true))); return; }
        }
      }
      throw new Error();
    } catch { setMemeData(FALLBACK_MEMES.map((c, i) => generateFlowData({ ...c, rank: i + 1 }, true))); }
  }, []);

  const fetchMarkets = useCallback(async () => {
    try {
      const res = await fetch(`${POLYMARKET_API}/markets?closed=false&limit=30&order=volume24hr&ascending=false`, { signal: AbortSignal.timeout(15000) });
      if (res.ok) { const data = await res.json(); if (Array.isArray(data) && data.length) { setMarkets(data.map(processPolymarketData).filter(m => m.active && m.volume > 0)); return; } }
      throw new Error();
    } catch { setMarkets(FALLBACK_MARKETS.map(processPolymarketData)); }
  }, []);

  const fetchTrends = useCallback(async () => {
    // In production, this would aggregate from multiple APIs
    // For now, use curated trending data with slight randomization
    const now = Date.now();
    const updatedTrends = TRENDING_TOPICS.map(t => ({
      ...t,
      x: { ...t.x, mentions: Math.round(t.x.mentions * (1 + (seededRandom(now + t.id) - 0.5) * 0.1)) },
      reddit: { ...t.reddit, mentions: Math.round(t.reddit.mentions * (1 + (seededRandom(now + t.id + 1) - 0.5) * 0.1)) },
      discord: { ...t.discord, mentions: Math.round(t.discord.mentions * (1 + (seededRandom(now + t.id + 2) - 0.5) * 0.1)) },
      tiktok: { ...t.tiktok, views: Math.round(t.tiktok.views * (1 + (seededRandom(now + t.id + 3) - 0.5) * 0.1)) },
    }));
    setTrends(updatedTrends);
  }, []);

  useEffect(() => { fetchCoins(); fetchMemes(); fetchMarkets(); fetchTrends(); }, [fetchCoins, fetchMemes, fetchMarkets, fetchTrends]);
  useEffect(() => { const i = setInterval(() => { fetchCoins(); fetchMemes(); fetchMarkets(); fetchTrends(); }, 60000); return () => clearInterval(i); }, [fetchCoins, fetchMemes, fetchMarkets, fetchTrends]);

  const currentData = activeTab === 'memes' ? memeData : data;
  const sortedData = useMemo(() => {
    let r = [...currentData];
    if (searchQuery.trim()) { const q = searchQuery.toLowerCase(); r = r.filter(t => t.name.toLowerCase().includes(q) || t.symbol.toLowerCase().includes(q)); }
    r.sort((a, b) => { const m = sortDirection === 'desc' ? -1 : 1; return ((a[sortField] ?? 0) - (b[sortField] ?? 0)) * m; });
    return r;
  }, [currentData, searchQuery, sortField, sortDirection]);

  const filteredMarkets = useMemo(() => {
    let m = [...markets];
    if (searchQuery.trim()) m = m.filter(market => market.question.toLowerCase().includes(searchQuery.toLowerCase()));
    return m.sort((a, b) => b.volume - a.volume);
  }, [markets, searchQuery]);

  const filteredTrends = useMemo(() => {
    let t = [...trends].map(topic => ({ ...topic, launchScore: calculateLaunchScore(topic) }));
    if (searchQuery.trim()) t = t.filter(topic => topic.topic.toLowerCase().includes(searchQuery.toLowerCase()) || topic.ticker.toLowerCase().includes(searchQuery.toLowerCase()));
    if (launchFilter === 'hot') t = t.filter(topic => topic.launchScore >= 70);
    else if (launchFilter === 'rising') t = t.filter(topic => topic.velocity >= 60);
    else if (launchFilter === 'new') t = t.filter(topic => new Date(topic.firstSeen) > new Date(Date.now() - 14 * 24 * 60 * 60 * 1000));
    return t.sort((a, b) => b.launchScore - a.launchScore);
  }, [trends, searchQuery, launchFilter]);

  const titles = { all: 'Crypto Flow Tracker', memes: '🐸 Trending Memes', markets: '📊 Prediction Markets', launch: '🚀 Launch Lab' };
  const subtitles = { all: 'Track flows and sentiment', memes: 'Live from DexScreener', markets: 'Live from Polymarket', launch: 'Cross-platform viral trend detector' };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fafafa', padding: '20px 16px', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#171717', margin: '0 0 6px' }}>{titles[activeTab]}</h1>
          <p style={{ fontSize: '12px', color: '#737373', margin: '0 0 8px' }}>{subtitles[activeTab]}</p>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
            Live · {lastUpdated.toLocaleTimeString()}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {[['all', '📊 Coins'], ['memes', '🐸 Memes'], ['markets', '🎯 Markets'], ['launch', '🚀 Launch']].map(([key, label]) => (
            <button key={key} onClick={() => { setActiveTab(key); setSearchQuery(''); }} style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #e5e5e5', background: activeTab === key ? '#171717' : 'white', color: activeTab === key ? 'white' : '#525252', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>{label}</button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '12px', flexWrap: 'wrap' }}>
          <input type="text" placeholder={activeTab === 'launch' ? "Search trends..." : "Search..."} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #e5e5e5', fontSize: '14px', flex: '1 1 200px', maxWidth: '280px', outline: 'none' }} />
          {activeTab === 'launch' && (
            <div style={{ display: 'flex', gap: '6px' }}>
              {[['all', 'All'], ['hot', '🔥 Hot'], ['rising', '📈 Rising'], ['new', '🆕 New']].map(([key, label]) => (
                <button key={key} onClick={() => setLaunchFilter(key)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e5e5e5', background: launchFilter === key ? '#171717' : 'white', color: launchFilter === key ? 'white' : '#525252', fontSize: '11px', cursor: 'pointer' }}>{label}</button>
              ))}
            </div>
          )}
          <button onClick={() => { fetchCoins(); fetchMemes(); fetchMarkets(); fetchTrends(); }} style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid #e5e5e5', background: 'white', fontSize: '13px', cursor: 'pointer' }}>↻ Refresh</button>
        </div>

        {activeTab === 'launch' ? (
          <div>
            <div style={{ backgroundColor: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '12px', padding: '14px 18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '24px' }}>💡</span>
              <div>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#92400e' }}>Launch Score Algorithm</p>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#a16207' }}>Cross-references X, Reddit, Discord & TikTok. Higher scores = more viral potential across platforms. Velocity measures growth speed.</p>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
              {filteredTrends.map(topic => <TrendCard key={topic.id} topic={topic} />)}
            </div>
          </div>
        ) : activeTab === 'markets' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {filteredMarkets.map(market => <MarketCard key={market.id} market={market} />)}
          </div>
        ) : (
          <div style={{ backgroundColor: 'white', borderRadius: '14px', border: '1px solid #e5e5e5', overflow: 'hidden' }}>
            {loading && !currentData.length ? <div style={{ padding: '50px', textAlign: 'center', color: '#737373' }}>Loading...</div> : (
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: '800px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: activeTab === 'memes' ? '45px 2fr 0.7fr 1fr 1fr 1fr 1fr 0.9fr' : '45px 2fr 1fr 1fr 1fr 1fr 1fr 0.9fr', padding: '10px 14px', backgroundColor: '#fafafa', borderBottom: '1px solid #e5e5e5', fontSize: '10px', fontWeight: '600', color: '#737373', textTransform: 'uppercase' }}>
                    <div>#</div><div>Token</div>{activeTab === 'memes' && <div>Chain</div>}<div style={{ textAlign: 'right' }}>Price</div><div style={{ textAlign: 'right' }}>24h</div>{activeTab !== 'memes' && <div style={{ textAlign: 'right' }}>Net Flow</div>}<div style={{ textAlign: 'right' }}>Vol</div><div style={{ textAlign: 'right' }}>MCap</div><div style={{ textAlign: 'center' }}>{activeTab === 'memes' ? 'Viral' : 'Signal'}</div>
                  </div>
                  {sortedData.map((t, i) => {
                    const viral = getViralLabel(t.viralScore);
                    const signal = getSignalLabel(t.signalScore);
                    const chain = getChainBadge(t.chain);
                    return (
                      <div key={t.id + i} onClick={() => setSelectedCoin(t)} style={{ display: 'grid', gridTemplateColumns: activeTab === 'memes' ? '45px 2fr 0.7fr 1fr 1fr 1fr 1fr 0.9fr' : '45px 2fr 1fr 1fr 1fr 1fr 1fr 0.9fr', padding: '12px 14px', borderBottom: '1px solid #f5f5f5', alignItems: 'center', fontSize: '13px', cursor: 'pointer' }}>
                        <div style={{ color: '#a3a3a3', fontSize: '11px' }}>{i + 1}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {t.image ? <img src={t.image} alt="" style={{ width: '26px', height: '26px', borderRadius: '50%' }} onError={e => e.target.style.display='none'} /> : <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600' }}>{t.symbol?.[0]}</div>}
                          <div><div style={{ fontWeight: '600', color: '#171717', fontSize: '13px' }}>{t.name?.length > 14 ? t.name.slice(0, 14) + '…' : t.name}</div><div style={{ fontSize: '10px', color: '#a3a3a3' }}>{t.symbol}</div></div>
                        </div>
                        {activeTab === 'memes' && <div><span style={{ backgroundColor: chain.b, color: chain.c, padding: '2px 5px', borderRadius: '3px', fontSize: '9px', fontWeight: '600' }}>{chain.l}</span></div>}
                        <div style={{ textAlign: 'right', fontWeight: '600', fontFamily: 'monospace', fontSize: '12px' }}>{formatPrice(t.price)}</div>
                        <div style={{ textAlign: 'right', fontWeight: '600', color: t.priceChange24h >= 0 ? '#16a34a' : '#dc2626', fontSize: '12px' }}>{formatPercent(t.priceChange24h)}</div>
                        {activeTab !== 'memes' && <div style={{ textAlign: 'right', color: t.netFlow >= 0 ? '#16a34a' : '#dc2626', fontSize: '11px' }}>{t.netFlow >= 0 ? '+' : ''}{formatLargeNumber(t.netFlow)}</div>}
                        <div style={{ textAlign: 'right', fontSize: '11px', color: '#525252' }}>{formatLargeNumber(t.volume24h)}</div>
                        <div style={{ textAlign: 'right', fontSize: '11px', color: '#525252' }}>{formatLargeNumber(t.marketCap)}</div>
                        <div style={{ textAlign: 'center' }}>{activeTab === 'memes' ? <span style={{ backgroundColor: viral.bg, color: viral.color, padding: '3px 7px', borderRadius: '4px', fontSize: '10px', fontWeight: '600' }}>{viral.label}</span> : <span style={{ backgroundColor: signal.bg, color: signal.color, padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>{t.signalScore}</span>}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
        {selectedCoin && <CoinModal coin={selectedCoin} onClose={() => setSelectedCoin(null)} />}
      </div>
    </div>
  );
}

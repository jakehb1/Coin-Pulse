import React, { useState, useEffect, useCallback, useMemo } from 'react';

const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const DEXSCREENER_API = 'https://api.dexscreener.com';

// Fallback data
const FALLBACK_COINS = [
  { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', current_price: 97500, price_change_percentage_24h: 2.5, market_cap: 1920000000000, total_volume: 45000000000, market_cap_rank: 1, image: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png' },
  { id: 'ethereum', symbol: 'eth', name: 'Ethereum', current_price: 3450, price_change_percentage_24h: 1.8, market_cap: 415000000000, total_volume: 22000000000, market_cap_rank: 2, image: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' },
  { id: 'solana', symbol: 'sol', name: 'Solana', current_price: 185, price_change_percentage_24h: 3.2, market_cap: 89000000000, total_volume: 4500000000, market_cap_rank: 5, image: 'https://assets.coingecko.com/coins/images/4128/small/solana.png' },
];

const FALLBACK_MEMES = [
  { id: 'doge', symbol: 'DOGE', name: 'Dogecoin', price: 0.38, priceChange24h: 5.5, marketCap: 56000000000, volume24h: 4200000000, chain: 'multi' },
  { id: 'pepe', symbol: 'PEPE', name: 'Pepe', price: 0.0000195, priceChange24h: 8.5, marketCap: 8200000000, volume24h: 2100000000, chain: 'ethereum' },
  { id: 'wif', symbol: 'WIF', name: 'dogwifhat', price: 2.85, priceChange24h: 15.2, marketCap: 2850000000, volume24h: 1200000000, chain: 'solana' },
];

// Utility functions
const seededRandom = (seed) => { const x = Math.sin(seed) * 10000; return x - Math.floor(x); };

const generateFlowData = (coin, isMeme = false) => {
  const volume = coin.total_volume || coin.volume24h || 1000000;
  const seed = (coin.symbol || 'X').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const inflow24h = volume * (0.35 + seededRandom(seed + 10) * 0.3);
  const outflow24h = volume * (0.35 + seededRandom(seed + 11) * 0.3);
  const netFlow = inflow24h - outflow24h;
  const priceChange24h = coin.price_change_percentage_24h || coin.priceChange24h || 0;
  const signalScore = Math.min(100, Math.floor(50 + priceChange24h * 2 + (netFlow/volume) * 50));

  return {
    id: coin.id, symbol: (coin.symbol || '').toUpperCase(), name: coin.name || 'Unknown',
    image: coin.image || '', price: coin.current_price || coin.price || 0,
    priceChange24h, marketCap: coin.market_cap || coin.marketCap || 0,
    volume24h: volume, netFlow, signalScore, isMeme,
    chain: coin.chain || '', viralScore: isMeme ? Math.min(100, 40 + Math.abs(priceChange24h) * 3) : 0,
  };
};

const formatPrice = (p) => p === 0 ? '$0' : p < 0.00001 ? `$${p.toExponential(2)}` : p < 0.001 ? `$${p.toFixed(8)}` : p < 1 ? `$${p.toFixed(4)}` : `$${p.toLocaleString(undefined, {maximumFractionDigits: 2})}`;
const formatLargeNumber = (n) => !n ? '-' : n >= 1e9 ? `$${(n/1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(1)}K` : `$${n.toFixed(0)}`;
const formatNumber = (n) => !n ? '0' : n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(1)}K` : n.toString();
const formatPercent = (n) => n == null ? '-' : `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

const getSignalLabel = (s) => s >= 70 ? { label: 'Strong', color: '#16a34a', bg: '#dcfce7' } : s >= 50 ? { label: 'Neutral', color: '#737373', bg: '#f5f5f5' } : { label: 'Weak', color: '#f97316', bg: '#fff7ed' };
const getViralLabel = (s) => s >= 80 ? { label: '🔥 VIRAL', color: '#dc2626', bg: '#fef2f2' } : s >= 60 ? { label: '🚀 HOT', color: '#f97316', bg: '#fff7ed' } : { label: '📈 Rising', color: '#eab308', bg: '#fefce8' };
const getChainBadge = (c) => ({ solana: { l: 'SOL', c: '#9945FF', b: '#f3e8ff' }, ethereum: { l: 'ETH', c: '#627EEA', b: '#eff6ff' }, base: { l: 'BASE', c: '#0052FF', b: '#eff6ff' } }[c] || { l: c?.slice(0,3)?.toUpperCase() || '?', c: '#737373', b: '#f5f5f5' });

const getCategoryColor = (cat) => ({
  'Crypto': { bg: '#fef3c7', color: '#92400e' },
  'Politics': { bg: '#dbeafe', color: '#1e40af' },
  'Economics': { bg: '#dcfce7', color: '#166534' },
  'Sports': { bg: '#fee2e2', color: '#991b1b' },
  'AI': { bg: '#cffafe', color: '#0e7490' },
  'Entertainment': { bg: '#fce7f3', color: '#9d174d' },
  'Meme': { bg: '#f3e8ff', color: '#7c3aed' },
  'Tech': { bg: '#e0e7ff', color: '#3730a3' },
  'General': { bg: '#f5f5f5', color: '#525252' },
}[cat] || { bg: '#f5f5f5', color: '#525252' });

const getLaunchColor = (score) => {
  if (score >= 85) return { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' };
  if (score >= 70) return { bg: '#fff7ed', border: '#fed7aa', text: '#ea580c' };
  if (score >= 55) return { bg: '#fefce8', border: '#fef08a', text: '#ca8a04' };
  if (score >= 40) return { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a' };
  return { bg: '#ecfeff', border: '#a5f3fc', text: '#0891b2' };
};

// Trend Card Component
const TrendCard = ({ topic }) => {
  const catColor = getCategoryColor(topic.category);
  const launchColor = getLaunchColor(topic.launchScore);
  const hasWiki = !!topic.sources?.wikipedia;
  const hasHN = !!topic.sources?.hackernews;
  const hasLemmy = !!topic.sources?.lemmy;
  const hasCrypto = !!topic.sources?.crypto;
  const hasDEX = !!topic.sources?.dex;
  const sourceCount = [hasWiki, hasHN, hasLemmy, hasCrypto, hasDEX].filter(Boolean).length;
  
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '14px', border: `2px solid ${topic.launchScore >= 70 ? launchColor.border : '#e5e5e5'}`, padding: '16px', boxShadow: topic.launchScore >= 85 ? '0 4px 20px rgba(220, 38, 38, 0.15)' : 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <span style={{ backgroundColor: catColor.bg, color: catColor.color, padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase' }}>{topic.category}</span>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {hasWiki && <span style={{ backgroundColor: '#f0f9ff', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: '600' }}>Wiki</span>}
          {hasHN && <span style={{ backgroundColor: '#fff7ed', color: '#ea580c', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: '600' }}>HN</span>}
          {hasLemmy && <span style={{ backgroundColor: '#dbeafe', color: '#2563eb', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: '600' }}>Lemmy</span>}
          {hasCrypto && <span style={{ backgroundColor: '#fef3c7', color: '#d97706', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: '600' }}>Crypto</span>}
          {hasDEX && <span style={{ backgroundColor: '#f3e8ff', color: '#7c3aed', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: '600' }}>DEX</span>}
        </div>
      </div>
      
      <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#171717', margin: '0 0 4px', lineHeight: '1.3', textTransform: 'capitalize' }}>{topic.topic}</h3>
      <p style={{ fontSize: '12px', color: '#737373', margin: '0 0 12px', fontFamily: 'monospace' }}>{topic.ticker}</p>
      
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {hasWiki && (
          <div style={{ flex: '1 1 80px', padding: '8px', backgroundColor: '#f0f9ff', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '9px', color: '#0369a1', fontWeight: '600', marginBottom: '2px' }}>Wiki Views</div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0c4a6e' }}>{formatLargeNumber(topic.sources.wikipedia.views)}</div>
            <div style={{ fontSize: '9px', color: '#0369a1' }}>#{topic.sources.wikipedia.rank} trending</div>
          </div>
        )}
        {hasHN && (
          <div style={{ flex: '1 1 80px', padding: '8px', backgroundColor: '#fff7ed', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '9px', color: '#ea580c', fontWeight: '600', marginBottom: '2px' }}>HN Score</div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#c2410c' }}>{formatNumber(topic.sources.hackernews.score)}</div>
            <div style={{ fontSize: '9px', color: '#ea580c' }}>{topic.sources.hackernews.mentions} mentions</div>
          </div>
        )}
        {hasLemmy && (
          <div style={{ flex: '1 1 80px', padding: '8px', backgroundColor: '#dbeafe', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '9px', color: '#2563eb', fontWeight: '600', marginBottom: '2px' }}>Lemmy Score</div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1d4ed8' }}>{formatNumber(topic.sources.lemmy.score)}</div>
            <div style={{ fontSize: '9px', color: '#2563eb' }}>{topic.sources.lemmy.mentions} mentions</div>
          </div>
        )}
        {hasCrypto && (
          <>
            <div style={{ flex: '1 1 80px', padding: '8px', backgroundColor: '#fef3c7', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '9px', color: '#d97706', fontWeight: '600', marginBottom: '2px' }}>Trending</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#b45309' }}>#{topic.sources.crypto.rank || '?'}</div>
              <div style={{ fontSize: '9px', color: '#d97706' }}>on CoinGecko</div>
            </div>
            {topic.sources.crypto.change24h !== undefined && (
              <div style={{ flex: '1 1 80px', padding: '8px', backgroundColor: topic.sources.crypto.change24h >= 0 ? '#dcfce7' : '#fee2e2', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '9px', color: topic.sources.crypto.change24h >= 0 ? '#16a34a' : '#dc2626', fontWeight: '600', marginBottom: '2px' }}>24h Change</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: topic.sources.crypto.change24h >= 0 ? '#15803d' : '#b91c1c' }}>{topic.sources.crypto.change24h >= 0 ? '+' : ''}{topic.sources.crypto.change24h?.toFixed(1)}%</div>
              </div>
            )}
          </>
        )}
        {hasDEX && (
          <>
            <div style={{ flex: '1 1 80px', padding: '8px', backgroundColor: '#f3e8ff', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '9px', color: '#7c3aed', fontWeight: '600', marginBottom: '2px' }}>DEX Price</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#6d28d9' }}>{formatPrice(topic.sources.dex.price)}</div>
              <div style={{ fontSize: '9px', color: '#7c3aed' }}>{topic.sources.dex.dex}</div>
            </div>
            {topic.sources.dex.volume > 0 && (
              <div style={{ flex: '1 1 80px', padding: '8px', backgroundColor: '#ede9fe', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '9px', color: '#7c3aed', fontWeight: '600', marginBottom: '2px' }}>Vol 24h</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#6d28d9' }}>{formatLargeNumber(topic.sources.dex.volume)}</div>
              </div>
            )}
          </>
        )}
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: launchColor.bg, borderRadius: '10px', border: `1px solid ${launchColor.border}` }}>
        <div>
          <div style={{ fontSize: '10px', color: '#737373', marginBottom: '2px' }}>Launch Score</div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: launchColor.text }}>{topic.launchScore}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ backgroundColor: 'white', color: launchColor.text, padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', border: `1px solid ${launchColor.border}` }}>{topic.launchLabel?.label || '👀 WATCH'}</span>
          {sourceCount >= 2 && <div style={{ fontSize: '9px', color: '#16a34a', marginTop: '4px', fontWeight: '600' }}>✓ {sourceCount} sources</div>}
        </div>
      </div>
      
      {hasHN && topic.sources.hackernews.stories?.length > 0 && (
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f5f5f5' }}>
          <div style={{ fontSize: '10px', color: '#737373', marginBottom: '6px', fontWeight: '600' }}>Related on HN:</div>
          {topic.sources.hackernews.stories.slice(0, 2).map((story, i) => (
            <a key={i} href={story.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', fontSize: '11px', color: '#ea580c', textDecoration: 'none', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🔗 {story.title}</a>
          ))}
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('trends');
  const [data, setData] = useState([]);
  const [memeData, setMemeData] = useState([]);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trendLoading, setTrendLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [trendSource, setTrendSource] = useState({ hackernews: false, lemmy: false, crypto: false, dex: false, wikipedia: false });
  const [launchFilter, setLaunchFilter] = useState('all');
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState('');

  // Fetch live trends
  const fetchTrends = useCallback(async () => {
    setTrendLoading(true);
    setError(null);
    setDebugInfo('Fetching trends...');
    
    try {
      const res = await fetch('/api/aggregate', { signal: AbortSignal.timeout(30000) });
      const responseText = await res.text();
      
      if (res.ok) {
        try {
          const data = JSON.parse(responseText);
          if (data.success && data.topics?.length) {
            setTrends(data.topics);
            setTrendSource(data.sources || { hackernews: false, lemmy: false, crypto: false, dex: false });
            setLastUpdated(new Date());
            const d = data.debug || {};
            setDebugInfo(`✓ Wiki: ${d.wikipedia || 0} | HN: ${d.hackernews || 0} | Lemmy: ${d.lemmy || 0} | Crypto: ${d.crypto || 0} | DEX: ${d.dex || 0}`);
          } else {
            setError('No trends available. Try refreshing.');
            setDebugInfo(`API returned 0 topics. Debug: ${JSON.stringify(data.debug || {})}`);
          }
        } catch (parseErr) {
          setError(`Parse error: ${parseErr.message}`);
          setDebugInfo(`Response: ${responseText.slice(0, 200)}`);
        }
      } else {
        setError(`API error: ${res.status}`);
        setDebugInfo(`HTTP ${res.status}: ${responseText.slice(0, 200)}`);
      }
    } catch (err) {
      setError(`Network error: ${err.message}`);
      setDebugInfo(`Error: ${err.message}`);
    } finally {
      setTrendLoading(false);
    }
  }, []);

  const fetchCoins = useCallback(async () => {
    try {
      const res = await fetch(`${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=30&page=1&sparkline=false&price_change_percentage=24h`, { signal: AbortSignal.timeout(15000) });
      if (res.ok) { const coins = await res.json(); if (coins?.length) { setData(coins.map(c => generateFlowData(c, false))); return; } }
    } catch {}
    setData(FALLBACK_COINS.map(c => generateFlowData(c, false)));
  }, []);

  const fetchMemes = useCallback(async () => {
    try {
      const res = await fetch(`${DEXSCREENER_API}/token-boosts/top/v1`, { signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const boosts = await res.json();
        if (boosts?.length > 3) {
          const pairs = await Promise.all(boosts.slice(0, 15).map(async t => {
            try { const r = await fetch(`${DEXSCREENER_API}/latest/dex/tokens/${t.tokenAddress}`); const d = await r.json(); return d.pairs?.[0] ? { id: d.pairs[0].baseToken?.address, symbol: d.pairs[0].baseToken?.symbol, name: d.pairs[0].baseToken?.name, price: parseFloat(d.pairs[0].priceUsd || 0), priceChange24h: parseFloat(d.pairs[0].priceChange?.h24 || 0), marketCap: parseFloat(d.pairs[0].fdv || 0), volume24h: parseFloat(d.pairs[0].volume?.h24 || 0), chain: d.pairs[0].chainId } : null; } catch { return null; }
          }));
          const valid = pairs.filter(Boolean);
          if (valid.length > 3) { setMemeData(valid.map(p => generateFlowData(p, true))); return; }
        }
      }
    } catch {}
    setMemeData(FALLBACK_MEMES.map(c => generateFlowData(c, true)));
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchCoins(), fetchMemes(), fetchTrends()]).finally(() => setLoading(false));
  }, [fetchCoins, fetchMemes, fetchTrends]);

  useEffect(() => {
    const interval = setInterval(() => { fetchTrends(); fetchCoins(); fetchMemes(); }, 120000);
    return () => clearInterval(interval);
  }, [fetchTrends, fetchCoins, fetchMemes]);

  const filteredTrends = useMemo(() => {
    let t = [...trends];
    if (searchQuery.trim()) t = t.filter(x => x.topic.toLowerCase().includes(searchQuery.toLowerCase()) || x.ticker?.toLowerCase().includes(searchQuery.toLowerCase()));
    if (launchFilter === 'hot') t = t.filter(x => x.launchScore >= 65);
    else if (launchFilter === 'cross') t = t.filter(x => x.sourceCount >= 2 || x.crossPlatform);
    else if (launchFilter === 'pop') t = t.filter(x => x.category === 'Entertainment' || x.sources?.wikipedia);
    else if (launchFilter === 'crypto') t = t.filter(x => x.category === 'Crypto' || x.sources?.crypto || x.sources?.dex);
    else if (launchFilter === 'tech') t = t.filter(x => ['Tech', 'AI', 'Gaming'].includes(x.category) || x.sources?.hackernews);
    return t;
  }, [trends, searchQuery, launchFilter]);

  const currentData = activeTab === 'memes' ? memeData : data;
  const filteredData = useMemo(() => {
    let d = [...currentData];
    if (searchQuery.trim()) d = d.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.symbol.toLowerCase().includes(searchQuery.toLowerCase()));
    return d.sort((a, b) => b.signalScore - a.signalScore);
  }, [currentData, searchQuery]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fafafa', padding: '20px 16px', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#171717', margin: '0 0 6px' }}>
            {activeTab === 'trends' ? '🔥 Trends' : activeTab === 'memes' ? '🐸 Memes' : 'Crypto Tracker'}
          </h1>
          <p style={{ fontSize: '12px', color: '#737373', margin: '0 0 10px' }}>
            {activeTab === 'trends' ? 'Real-time cross-platform trend detection' : activeTab === 'memes' ? 'Live from DexScreener' : 'Live prices'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {activeTab === 'trends' && (
              <>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', backgroundColor: trendSource.wikipedia ? '#dcfce7' : '#fef3c7', color: trendSource.wikipedia ? '#166534' : '#92400e', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: trendSource.wikipedia ? '#22c55e' : '#f59e0b' }} />Wiki {trendSource.wikipedia ? '✓' : '○'}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', backgroundColor: trendSource.hackernews ? '#dcfce7' : '#fef3c7', color: trendSource.hackernews ? '#166534' : '#92400e', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: trendSource.hackernews ? '#22c55e' : '#f59e0b' }} />HN {trendSource.hackernews ? '✓' : '○'}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', backgroundColor: trendSource.lemmy ? '#dcfce7' : '#fef3c7', color: trendSource.lemmy ? '#166534' : '#92400e', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: trendSource.lemmy ? '#22c55e' : '#f59e0b' }} />Lemmy {trendSource.lemmy ? '✓' : '○'}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', backgroundColor: trendSource.crypto ? '#dcfce7' : '#fef3c7', color: trendSource.crypto ? '#166534' : '#92400e', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: trendSource.crypto ? '#22c55e' : '#f59e0b' }} />Crypto {trendSource.crypto ? '✓' : '○'}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', backgroundColor: trendSource.dex ? '#dcfce7' : '#fef3c7', color: trendSource.dex ? '#166534' : '#92400e', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: trendSource.dex ? '#22c55e' : '#f59e0b' }} />DEX {trendSource.dex ? '✓' : '○'}
                </span>
              </>
            )}
            <span style={{ padding: '4px 10px', backgroundColor: '#f5f5f5', color: '#737373', borderRadius: '10px', fontSize: '11px' }}>Updated: {lastUpdated.toLocaleTimeString()}</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {[['trends', '🔥 Trends'], ['all', '📊 Coins'], ['memes', '🐸 Memes']].map(([key, label]) => (
            <button key={key} onClick={() => { setActiveTab(key); setSearchQuery(''); }} style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid #e5e5e5', background: activeTab === key ? '#171717' : 'white', color: activeTab === key ? 'white' : '#525252', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>{label}</button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
          <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #e5e5e5', fontSize: '14px', flex: '1 1 200px', maxWidth: '280px', outline: 'none' }} />
          {activeTab === 'trends' && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[['all', 'All'], ['hot', '🔥 Hot'], ['cross', '✓ Cross'], ['pop', '🎬 Pop'], ['crypto', '🪙 Crypto'], ['tech', '💻 Tech']].map(([key, label]) => (
                <button key={key} onClick={() => setLaunchFilter(key)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e5e5e5', background: launchFilter === key ? '#171717' : 'white', color: launchFilter === key ? 'white' : '#525252', fontSize: '11px', cursor: 'pointer' }}>{label}</button>
              ))}
            </div>
          )}
          <button onClick={() => { fetchTrends(); fetchCoins(); fetchMemes(); }} disabled={trendLoading} style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid #e5e5e5', background: trendLoading ? '#f5f5f5' : 'white', fontSize: '13px', cursor: trendLoading ? 'wait' : 'pointer' }}>{trendLoading ? '⏳...' : '↻ Refresh'}</button>
        </div>

        {error && activeTab === 'trends' && (
          <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', color: '#1e40af', fontSize: '13px' }}>ℹ️ {error}</div>
        )}
        
        {debugInfo && activeTab === 'trends' && (
          <div style={{ backgroundColor: '#fefce8', border: '1px solid #fef08a', borderRadius: '10px', padding: '8px 12px', marginBottom: '16px', color: '#854d0e', fontSize: '11px', fontFamily: 'monospace', wordBreak: 'break-all' }}>🔍 Debug: {debugInfo}</div>
        )}

        {activeTab === 'trends' && (
          <div>
            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '14px 18px', marginBottom: '16px' }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#166534' }}><strong>🔍 How it works:</strong> Aggregates trends from Wikipedia (entertainment/pop culture), Hacker News (tech), Lemmy (community), CoinGecko (crypto), and DEX (meme coins). Topics on multiple sources get boosted!</p>
            </div>
            {trendLoading && !trends.length ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#737373' }}><div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>Fetching live trends...</div>
            ) : !trends.length ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#737373' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔍</div>
                <div style={{ marginBottom: '8px' }}>No trends loaded yet</div>
                <div style={{ fontSize: '11px', color: '#a3a3a3' }}>Check the debug info above for details. Try refreshing or check Vercel function logs.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
                {filteredTrends.map((t, i) => <TrendCard key={t.topic + i} topic={t} />)}
              </div>
            )}
          </div>
        )}

        {(activeTab === 'all' || activeTab === 'memes') && (
          <div style={{ backgroundColor: 'white', borderRadius: '14px', border: '1px solid #e5e5e5', overflow: 'hidden' }}>
            {loading && !currentData.length ? <div style={{ padding: '50px', textAlign: 'center', color: '#737373' }}>Loading...</div> : (
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: '700px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '45px 2fr 1fr 1fr 1fr 1fr 0.8fr', padding: '10px 14px', backgroundColor: '#fafafa', borderBottom: '1px solid #e5e5e5', fontSize: '10px', fontWeight: '600', color: '#737373', textTransform: 'uppercase' }}>
                    <div>#</div><div>Token</div><div style={{ textAlign: 'right' }}>Price</div><div style={{ textAlign: 'right' }}>24h</div><div style={{ textAlign: 'right' }}>Vol</div><div style={{ textAlign: 'right' }}>MCap</div><div style={{ textAlign: 'center' }}>Score</div>
                  </div>
                  {filteredData.map((t, i) => {
                    const signal = getSignalLabel(t.signalScore);
                    const viral = getViralLabel(t.viralScore);
                    const chain = getChainBadge(t.chain);
                    return (
                      <div key={t.id + i} style={{ display: 'grid', gridTemplateColumns: '45px 2fr 1fr 1fr 1fr 1fr 0.8fr', padding: '12px 14px', borderBottom: '1px solid #f5f5f5', alignItems: 'center', fontSize: '13px' }}>
                        <div style={{ color: '#a3a3a3', fontSize: '11px' }}>{i + 1}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {t.image ? <img src={t.image} alt="" style={{ width: '26px', height: '26px', borderRadius: '50%' }} onError={e => e.target.style.display='none'} /> : <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600' }}>{t.symbol?.[0]}</div>}
                          <div>
                            <div style={{ fontWeight: '600', color: '#171717', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>{t.name?.slice(0, 14)}{activeTab === 'memes' && t.chain && <span style={{ backgroundColor: chain.b, color: chain.c, padding: '1px 4px', borderRadius: '3px', fontSize: '8px', fontWeight: '600' }}>{chain.l}</span>}</div>
                            <div style={{ fontSize: '10px', color: '#a3a3a3' }}>{t.symbol}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', fontWeight: '600', fontFamily: 'monospace', fontSize: '12px' }}>{formatPrice(t.price)}</div>
                        <div style={{ textAlign: 'right', fontWeight: '600', color: t.priceChange24h >= 0 ? '#16a34a' : '#dc2626', fontSize: '12px' }}>{formatPercent(t.priceChange24h)}</div>
                        <div style={{ textAlign: 'right', fontSize: '11px', color: '#525252' }}>{formatLargeNumber(t.volume24h)}</div>
                        <div style={{ textAlign: 'right', fontSize: '11px', color: '#525252' }}>{formatLargeNumber(t.marketCap)}</div>
                        <div style={{ textAlign: 'center' }}>
                          {activeTab === 'memes' ? <span style={{ backgroundColor: viral.bg, color: viral.color, padding: '3px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: '600' }}>{viral.label}</span> : <span style={{ backgroundColor: signal.bg, color: signal.color, padding: '3px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '600' }}>{t.signalScore}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

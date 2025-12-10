import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// Use Vercel serverless functions to proxy CoinGecko API (avoids CORS issues)
const COINGECKO_API = typeof window !== 'undefined' ? '/api' : 'https://api.coingecko.com/api/v3';
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
const formatLargeNumber = (n) => {
  if (!n || n === 0 || isNaN(n)) return '-';
  if (n >= 1e12) return `$${(n/1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n/1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n/1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n/1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
};
const formatNumber = (n) => !n ? '0' : n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(1)}K` : n.toString();
const formatPercent = (n) => {
  if (n == null || n === undefined || isNaN(n)) return '-';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
};

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

// Loading Spinner Component
const LoadingSpinner = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '30px', gap: '8px' }}>
    <div style={{ width: '24px', height: '24px', border: '3px solid #e5e5e5', borderTopColor: '#171717', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <span style={{ color: '#737373', fontSize: '13px' }}>Loading more trends...</span>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState('all');
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
  
  // Coins tab filters
  const [filterNoise, setFilterNoise] = useState(true);
  const [showStablecoins, setShowStablecoins] = useState(false);
  const previousRanksRef = useRef({});
  const lastCoinsFetchRef = useRef(0);
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState('rank');
  const [sortDirection, setSortDirection] = useState('asc');
  
  // Tooltip state
  const [showDeltaTooltip, setShowDeltaTooltip] = useState(false);
  const [showCircTooltip, setShowCircTooltip] = useState(false);
  const deltaTooltipRef = useRef(null);
  const circTooltipRef = useRef(null);
  
  // Infinite scroll state
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const observerRef = useRef(null);
  const loadMoreRef = useRef(null);
  
  // Memes pagination and caching
  const [memePage, setMemePage] = useState(1);
  const [allMemesCache, setAllMemesCache] = useState([]); // Cache all fetched memes for search
  const [memeLoadingMore, setMemeLoadingMore] = useState(false);

  // Fetch trends with pagination
  const fetchTrends = useCallback(async (pageNum = 1, append = false) => {
    if (pageNum === 1) {
      setTrendLoading(true);
      setError(null);
      setDebugInfo('Fetching trends...');
    } else {
      setLoadingMore(true);
    }
    
    try {
      // Add timestamp to prevent caching and ensure live data
      const timestamp = Date.now();
      const res = await fetch(`/api/aggregate?page=${pageNum}&limit=15&_t=${timestamp}`, { 
        signal: AbortSignal.timeout(30000),
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      const responseText = await res.text();
      
      if (res.ok) {
        try {
          const data = JSON.parse(responseText);
          if (data.success && data.topics?.length) {
            if (append) {
              setTrends(prev => {
                // Deduplicate by topic name
                const existingTopics = new Set(prev.map(t => t.topic.toLowerCase()));
                const newTopics = data.topics.filter(t => !existingTopics.has(t.topic.toLowerCase()));
                return [...prev, ...newTopics];
              });
            } else {
              setTrends(data.topics);
            }
            
            // Update pagination state
            if (data.pagination) {
              setHasMore(data.pagination.hasMore);
              setTotalCount(data.pagination.totalCount);
            }
            
            setTrendSource(data.sources || { hackernews: false, lemmy: false, crypto: false, dex: false });
            setLastUpdated(new Date());
            const d = data.debug || {};
            setDebugInfo(`✓ Wiki: ${d.wikipedia || 0} | HN: ${d.hackernews || 0} | Lemmy: ${d.lemmy || 0} | Crypto: ${d.crypto || 0} | DEX: ${d.dex || 0} | Page: ${pageNum}/${data.pagination?.totalPages || '?'}`);
          } else {
            if (pageNum === 1) {
              setError('No trends available. Try refreshing.');
              setDebugInfo(`API returned 0 topics. Debug: ${JSON.stringify(data.debug || {})}`);
            }
            setHasMore(false);
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
      setLoadingMore(false);
    }
  }, []);

  // Load more trends
  const loadMoreTrends = useCallback(() => {
    if (!loadingMore && hasMore && !searchQuery.trim() && launchFilter === 'all') {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchTrends(nextPage, true);
    }
  }, [loadingMore, hasMore, page, fetchTrends, searchQuery, launchFilter]);

  // Load more memes
  const loadMoreMemes = useCallback(() => {
    if (!memeLoadingMore && hasMore && !searchQuery.trim() && activeTab === 'memes') {
      const nextPage = memePage + 1;
      setMemePage(nextPage);
      fetchMemes(nextPage, true);
    }
  }, [memeLoadingMore, hasMore, memePage, fetchMemes, searchQuery, activeTab]);

  // Intersection Observer for infinite scroll (trends and memes)
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !memeLoadingMore) {
          if (activeTab === 'trends') {
          loadMoreTrends();
          } else if (activeTab === 'memes') {
            loadMoreMemes();
          }
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );
    
    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }
    
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [hasMore, loadingMore, memeLoadingMore, loadMoreTrends, loadMoreMemes, activeTab]);

  // Reset pagination when filters change
  useEffect(() => {
    setPage(1);
    setHasMore(true);
  }, [searchQuery, launchFilter]);

  const fetchCoins = useCallback(async () => {
    try {
      // Add timestamp to prevent caching and ensure live data
      const timestamp = Date.now();
      lastCoinsFetchRef.current = timestamp;
      
      // Use Vercel serverless function to proxy CoinGecko API (avoids CORS)
      const uniqueId = `${timestamp}-${Math.random().toString(36).substring(7)}`;
      const marketsUrl = typeof window !== 'undefined' 
        ? `/api/coingecko-markets?vs_currency=usd&per_page=100&page=1&_t=${uniqueId}&_r=${Math.random()}`
        : `${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h&_t=${uniqueId}&_r=${Math.random()}`;
      
      const res = await fetch(marketsUrl, { 
        signal: AbortSignal.timeout(20000),
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
          'If-None-Match': '*',
          'If-Modified-Since': '0' // Prevent 304 responses
        }
      });
      console.log('[DEBUG] Markets API response status:', res.status, res.statusText);
      
      let coins = null;
      
      // If we get 304, force a fresh request
      if (res.status === 304) {
        console.warn('[DEBUG] Got 304 - forcing fresh request');
        const forceTimestamp = Date.now();
        const forceRes = await fetch(`${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h&_t=${forceTimestamp}&_r=${Math.random()}&_force=${forceTimestamp}`, { 
          signal: AbortSignal.timeout(20000),
          cache: 'reload',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        if (forceRes.ok) {
          coins = await forceRes.json();
          console.log('[DEBUG] Force reload successful, got', coins?.length, 'coins');
        } else {
          console.error('[DEBUG] Force reload failed:', forceRes.status);
          return;
        }
      } else if (res.ok) {
        coins = await res.json();
        console.log('[DEBUG] Markets API response sample:', coins[0] ? {
          id: coins[0].id,
          name: coins[0].name,
          current_price: coins[0].current_price,
          circulating_supply: coins[0].circulating_supply,
          total_supply: coins[0].total_supply,
          market_cap: coins[0].market_cap,
          market_cap_rank: coins[0].market_cap_rank
        } : 'No coins');
        console.log('[DEBUG] Total coins received:', coins?.length);
        if (coins?.length) {
          // Fetch supply data for top 100 coins to ensure circ % is calculated
          // Use detail API for more accurate supply data
          const allCoinIds = coins.map(c => c.id);
          const supplyDataMap = new Map();
          
          // Fetch in batches of 10 to avoid rate limits (CoinGecko allows 10-50 calls/minute)
          // Process all coins but with proper rate limiting
          const batchSize = 10;
          const delayBetweenBatches = 1200; // 1.2 seconds between batches to stay under rate limit
          
          for (let i = 0; i < allCoinIds.length; i += batchSize) {
            const batch = allCoinIds.slice(i, i + batchSize);
            const batchPromises = batch.map(async (id) => {
              try {
                // Add unique timestamp to prevent caching
                  const detailTimestamp = Date.now();
                  const detailUniqueId = `${detailTimestamp}-${Math.random().toString(36).substring(7)}`;
                  const detailUrl = typeof window !== 'undefined'
                    ? `/api/coingecko-detail?id=${id}&_t=${detailUniqueId}&_r=${Math.random()}`
                    : `${COINGECKO_API}/coins/${id}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false&_t=${detailUniqueId}&_r=${Math.random()}`;
                  
                  const detailRes = await fetch(detailUrl, {
                      signal: AbortSignal.timeout(10000), // Increased timeout
                      cache: 'no-store',
                      headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
                        'Pragma': 'no-cache',
                        'Expires': '0',
                        'If-None-Match': '*',
                        'If-Modified-Since': '0' // Prevent 304 responses
                      }
                    }
                  );
                if (detailRes.ok) {
                  const detailData = await detailRes.json();
                  const supplyData = {
                    totalSupply: detailData.market_data?.total_supply,
                    circulatingSupply: detailData.market_data?.circulating_supply,
                    marketCap: detailData.market_data?.market_cap?.usd,
                    // Use price from detail API as it's more recent and accurate
                    currentPrice: detailData.market_data?.current_price?.usd,
                    priceChange24h: detailData.market_data?.price_change_percentage_24h
                  };
                  supplyDataMap.set(id, supplyData);
                  // Debug first few
                  if (i < 3) {
                    console.log(`[DEBUG] Detail API for ${id}:`, supplyData);
                  }
                  return true;
                } else {
                  console.warn(`[DEBUG] Detail API failed for ${id}:`, detailRes.status);
                  return false;
                }
              } catch (err) {
                console.warn(`[DEBUG] Detail API error for ${id}:`, err.message);
                return false;
              }
            });
            
            // Wait for batch to complete
            await Promise.all(batchPromises);
            
            // Add delay between batches to avoid rate limits (except for last batch)
            if (i + batchSize < allCoinIds.length) {
              await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
            }
          }
          
          console.log(`[DEBUG] Completed fetching detail data for ${supplyDataMap.size} coins`);
          
          // Store current ranks for delta calculation on next fetch
          const currentRanks = {};
          
          // Process coins with enhanced data
          const enhancedCoins = coins.map((coin, index) => {
            const supplyData = supplyDataMap.get(coin.id);
            
            // ALWAYS use fresh markets API price as base (just fetched, no cache)
            // Only override with detail API price if it's valid and available
            // Markets API is the source of truth since we just fetched it fresh
            const marketsPrice = coin.current_price;
            const detailPrice = supplyData?.currentPrice;
            
            // Use detail API price if available and valid, otherwise use fresh markets API price
            // Both are fresh since we just fetched them, but detail API might be slightly more recent
            const currentPrice = (detailPrice && detailPrice > 0 && !isNaN(detailPrice)) 
              ? detailPrice 
              : (marketsPrice && marketsPrice > 0 && !isNaN(marketsPrice)) 
                ? marketsPrice 
                : 0;
            
            // Same logic for 24h change
            const marketsPriceChange = coin.price_change_percentage_24h;
            const detailPriceChange = supplyData?.priceChange24h;
            const priceChange24h = (detailPriceChange !== undefined && detailPriceChange !== null && !isNaN(detailPriceChange))
              ? detailPriceChange
              : (marketsPriceChange !== undefined && marketsPriceChange !== null && !isNaN(marketsPriceChange))
                ? marketsPriceChange
                : 0;
            
            const marketCap = coin.market_cap || 0;
            
            // Get supply data from detail API (most accurate)
            const circulatingSupply = supplyData?.circulatingSupply || null;
            const totalSupply = supplyData?.totalSupply || null;
            
            // Use market cap from detail API if available (more accurate), otherwise use markets API
            const reportedMarketCap = supplyData?.marketCap || marketCap;
            
            // Calculate FDV: Fully Diluted Valuation = total_supply * current_price
            // Only calculate if we have both total supply and current price from API
            let fdv = null;
            if (totalSupply && currentPrice) {
              fdv = totalSupply * currentPrice;
            } else if (marketCap) {
              // Fallback: if no total supply, use market cap as FDV approximation
              fdv = marketCap;
            }
            
            // Calculate Circ %: (circulating_supply / total_supply) * 100
            // Using real-time data from detail API, with fallbacks to markets API
            let circPercent = null;
            
            // Try detail API first (most accurate) - check for valid numbers
            if (totalSupply != null && circulatingSupply != null && 
                typeof totalSupply === 'number' && typeof circulatingSupply === 'number' &&
                !isNaN(totalSupply) && !isNaN(circulatingSupply) &&
                isFinite(totalSupply) && isFinite(circulatingSupply) &&
                totalSupply > 0 && circulatingSupply > 0) {
              circPercent = (circulatingSupply / totalSupply) * 100;
              // Debug for first coin
              if (index === 0) {
                console.log(`[DEBUG] Circ % from detail API for ${coin.id}:`, {
                  circulatingSupply,
                  totalSupply,
                  circPercent
                });
              }
            } 
            // Fallback to markets API supply data
            else {
              const marketCirculating = coin.circulating_supply;
              const marketTotal = coin.total_supply;
              
              if (marketCirculating != null && marketTotal != null &&
                  typeof marketCirculating === 'number' && typeof marketTotal === 'number' &&
                  !isNaN(marketCirculating) && !isNaN(marketTotal) &&
                  isFinite(marketCirculating) && isFinite(marketTotal) &&
                  marketTotal > 0 && marketCirculating > 0) {
                circPercent = (marketCirculating / marketTotal) * 100;
                // Debug for first coin
                if (index === 0) {
                  console.log(`[DEBUG] Circ % from markets API for ${coin.id}:`, {
                    marketCirculating,
                    marketTotal,
                    circPercent
                  });
                }
              }
              // Last resort: calculate from market cap and price if we have total supply
              else if (marketCap && currentPrice && currentPrice > 0 && totalSupply && totalSupply > 0) {
                const calculatedCirculatingSupply = marketCap / currentPrice;
                if (calculatedCirculatingSupply > 0 && totalSupply > 0) {
                  circPercent = (calculatedCirculatingSupply / totalSupply) * 100;
                  if (index === 0) {
                    console.log(`[DEBUG] Circ % calculated from market cap for ${coin.id}:`, {
                      marketCap,
                      currentPrice,
                      calculatedCirculatingSupply,
                      totalSupply,
                      circPercent
                    });
                  }
                }
              }
            }
            
            // Ensure circPercent is a valid number between 0 and 100
            if (circPercent != null) {
              if (isNaN(circPercent) || !isFinite(circPercent) || circPercent < 0) {
                circPercent = null;
              } else if (circPercent > 100) {
                // Some coins have circ > total due to API inconsistencies, cap at 100
                circPercent = 100;
              }
            }
            
            // Calculate Delta: ranking change (previous_rank - current_rank)
            // Using real-time rank data from markets API
            // Positive delta = moved up in ranking, negative = moved down
            const currentRank = coin.market_cap_rank || (index + 1);
            currentRanks[coin.id] = currentRank; // Store for next comparison
            
            const previousRank = previousRanksRef.current[coin.id];
            
            // Calculate delta - null if no previous rank (first load), 0 if no change, otherwise show the change
            let delta = null;
            if (previousRank !== undefined && previousRank !== null) {
              if (previousRank !== currentRank) {
                delta = previousRank - currentRank; // Positive = moved up, negative = moved down
              } else {
                delta = 0; // No change in rank
              }
            }
            // If no previous rank (first load), delta stays null (will show "-")
            
            // Check if stablecoin
            const isStablecoin = ['usdt', 'usdc', 'dai', 'busd', 'tusd', 'usdp', 'usdd', 'frax', 'lusd', 'susd', 'gusd', 'husd', 'ousd', 'usdn', 'usdk', 'usdx', 'usd', 'ust', 'mim'].includes(coin.id?.toLowerCase() || coin.symbol?.toLowerCase() || '');
            
            // Create updated coin object with most recent price data
            // Always use the validated currentPrice we calculated above
            const updatedCoin = {
              ...coin,
              current_price: currentPrice, // Use validated price (detail API or fresh markets API)
              price_change_percentage_24h: priceChange24h // Use validated 24h change
            };
            
            const baseData = generateFlowData(updatedCoin, false);
            
            // Debug logging for first few coins
            if (index < 5) {
              console.log(`[DEBUG] Coin ${index + 1} - ${coin.id}:`, {
                marketsPrice,
                detailPrice,
                currentPrice,
                circulatingSupply: supplyData?.circulatingSupply,
                totalSupply: supplyData?.totalSupply,
                coinCirculatingSupply: coin.circulating_supply,
                coinTotalSupply: coin.total_supply,
                circPercent,
                previousRank,
                currentRank,
                delta,
                hasSupplyData: !!supplyData
              });
            }
            
            return {
              ...baseData,
              // Override price to ensure we use the validated currentPrice, not generateFlowData's fallback
              price: currentPrice, // Always use the validated price from API
              priceChange24h: priceChange24h, // Always use the validated 24h change from API
              fdv: fdv,
              reportedMarketCap: reportedMarketCap,
              circPercent: circPercent,
              rank: currentRank,
              delta: delta,
              isStablecoin: isStablecoin,
            };
          });
          
          // Update previous ranks for next delta calculation
          // Only update if we have data, otherwise keep existing ranks
          if (Object.keys(currentRanks).length > 0) {
            previousRanksRef.current = currentRanks;
          }
          
          console.log('[DEBUG] Updated previousRanksRef:', previousRanksRef.current);
          console.log('[DEBUG] Enhanced coins sample:', enhancedCoins.slice(0, 3).map(c => ({
            id: c.id,
            name: c.name,
            price: c.price,
            circPercent: c.circPercent,
            delta: c.delta,
            rank: c.rank
          })));
          console.log('[DEBUG] Supply data map size:', supplyDataMap.size);
          
          setData(enhancedCoins);
          setLastUpdated(new Date());
          return;
        }
      }
    } catch {}
    setData(FALLBACK_COINS.map(c => generateFlowData(c, false)));
  }, []);

  const fetchMemes = useCallback(async (pageNum = 1, append = false) => {
    try {
      setMemeLoadingMore(true);
      
      // Fast path: Fetch DexScreener first and show immediately, then add pump.fun in background
      const fetchDexScreener = async () => {
        const timestamp = Date.now();
        const res = await fetch(`${DEXSCREENER_API}/token-boosts/top/v1?_t=${timestamp}`, { 
          signal: AbortSignal.timeout(8000),
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
      if (res.ok) {
        const boosts = await res.json();
          if (boosts?.length > 0) {
            // Fetch details for top 20 tokens first (faster initial load)
            const initialBatch = pageNum === 1 ? boosts.slice(0, 20) : boosts.slice((pageNum - 1) * 20, pageNum * 20);
            const pairs = await Promise.all(
              initialBatch.map(async t => {
                try { 
                  const tokenTimestamp = Date.now();
                  const r = await fetch(`${DEXSCREENER_API}/latest/dex/tokens/${t.tokenAddress}?_t=${tokenTimestamp}`, {
                    cache: 'no-cache',
                    signal: AbortSignal.timeout(5000),
                    headers: {
                      'Cache-Control': 'no-cache, no-store, must-revalidate'
                    }
                  }); 
                  const d = await r.json(); 
                  return d.pairs?.[0] ? { 
                    id: d.pairs[0].baseToken?.address, 
                    symbol: d.pairs[0].baseToken?.symbol, 
                    name: d.pairs[0].baseToken?.name, 
                    price: parseFloat(d.pairs[0].priceUsd || 0), 
                    priceChange24h: parseFloat(d.pairs[0].priceChange?.h24 || 0), 
                    marketCap: parseFloat(d.pairs[0].fdv || 0), 
                    volume24h: parseFloat(d.pairs[0].volume?.h24 || 0), 
                    chain: d.pairs[0].chainId,
                    source: 'dexscreener'
                  } : null; 
                } catch { return null; }
              })
            );
            return pairs.filter(Boolean);
          }
        }
        return [];
      };
      
      // Fetch DexScreener first (faster, more reliable)
      const dexCoins = await fetchDexScreener();
      
      // Process and show DexScreener data immediately
      if (dexCoins.length > 0) {
        const processedDex = dexCoins.map(p => generateFlowData(p, true));
        processedDex.sort((a, b) => (b.signalScore || 0) - (a.signalScore || 0));
        
        if (append) {
          setAllMemesCache(prev => {
            const combined = [...prev, ...processedDex];
            const unique = new Map();
            combined.forEach(coin => {
              const key = coin.id?.toLowerCase();
              if (key && !unique.has(key)) unique.set(key, coin);
            });
            return Array.from(unique.values());
          });
          setMemeData(prev => {
            const combined = [...prev, ...processedDex];
            const unique = new Map();
            combined.forEach(coin => {
              const key = coin.id?.toLowerCase();
              if (key && !unique.has(key)) unique.set(key, coin);
            });
            return Array.from(unique.values());
          });
        } else {
          // First load - show DexScreener immediately
          setAllMemesCache(processedDex);
          setMemeData(processedDex);
        }
      }
      
      // Fetch pump.fun in background (non-blocking, only on first page)
      if (pageNum === 1 && !append) {
        // Use setTimeout to ensure this doesn't block rendering
        setTimeout(() => {
          fetch(`/api/pumpfun?limit=30&offset=0`).then(async res => {
            if (res.ok) {
              try {
                const data = await res.json();
                const coins = Array.isArray(data.coins) ? data.coins : Array.isArray(data) ? data : [];
                const pumpCoins = coins.map(coin => ({
                  id: coin.id || coin.mint || coin.address,
                  symbol: coin.symbol || 'UNKNOWN',
                  name: coin.name || coin.symbol || 'Unknown',
                  price: coin.price || 0,
                  priceChange24h: coin.priceChange24h || 0,
                  marketCap: coin.marketCap || 0,
                  volume24h: coin.volume24h || 0,
                  chain: coin.chain || 'solana',
                  image: coin.image || null,
                  source: 'pumpfun'
                })).filter(c => c.id);
                
                if (pumpCoins.length > 0) {
                  const processedPump = pumpCoins.map(p => generateFlowData(p, true));
                  
                  // Merge with existing data
                  setAllMemesCache(prev => {
                    const combined = [...prev, ...processedPump];
                    const unique = new Map();
                    combined.forEach(coin => {
                      const key = coin.id?.toLowerCase();
                      if (key && !unique.has(key)) unique.set(key, coin);
                    });
                    const merged = Array.from(unique.values());
                    merged.sort((a, b) => (b.signalScore || 0) - (a.signalScore || 0));
                    return merged;
                  });
                  
                  setMemeData(prev => {
                    const combined = [...prev, ...processedPump];
                    const unique = new Map();
                    combined.forEach(coin => {
                      const key = coin.id?.toLowerCase();
                      if (key && !unique.has(key)) unique.set(key, coin);
                    });
                    const merged = Array.from(unique.values());
                    merged.sort((a, b) => (b.signalScore || 0) - (a.signalScore || 0));
                    return merged;
                  });
                }
              } catch (err) {
                console.warn('[DEBUG] Pump.fun processing error:', err);
              }
            }
          }).catch(err => {
            console.warn('[DEBUG] Pump.fun API error:', err);
          });
        }, 100);
      }
      
      // If no data was loaded and it's first load, show fallback
      if (!append && dexCoins.length === 0) {
        const fallback = FALLBACK_MEMES.map(c => generateFlowData(c, true));
        setMemeData(fallback);
        setAllMemesCache(fallback);
      }
      
      // Set hasMore based on DexScreener results
      setHasMore(dexCoins.length >= 20);
      
      console.log(`[DEBUG] Fetched ${dexCoins.length} meme coins from DexScreener`);
    } catch (err) {
      console.error('[DEBUG] Memes fetch error:', err);
      if (!append) {
    setMemeData(FALLBACK_MEMES.map(c => generateFlowData(c, true)));
        setAllMemesCache(FALLBACK_MEMES.map(c => generateFlowData(c, true)));
      }
    } finally {
      setMemeLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchCoins(), fetchMemes(1, false), fetchTrends(1, false)]).finally(() => setLoading(false));
  }, [fetchCoins, fetchMemes, fetchTrends]);

  // Refresh coins when switching back to coins tab to ensure accurate prices
  useEffect(() => {
    if (activeTab === 'all') {
      // Check if data is stale (older than 30 seconds) and refresh if needed
      const timeSinceLastFetch = Date.now() - lastCoinsFetchRef.current;
      if (timeSinceLastFetch > 30000 || lastCoinsFetchRef.current === 0) {
        // Refresh coins data when user switches to coins tab if data is stale
        fetchCoins();
      }
    }
  }, [activeTab, fetchCoins]);

  // Auto-refresh: coins every 30 seconds (prices change frequently), trends every 2 minutes
  useEffect(() => {
    // Refresh coins more frequently for real-time prices (only when coins tab is active)
    const coinsInterval = setInterval(() => {
      if (activeTab === 'all') {
        console.log('[DEBUG] Auto-refreshing coins data...');
        fetchCoins();
      }
    }, 30000); // 30 seconds for coins
    
    // Refresh trends and memes less frequently
    const trendsInterval = setInterval(() => {
      if (activeTab === 'trends') {
      setPage(1);
      setHasMore(true);
      fetchTrends(1, false);
      }
      if (activeTab === 'memes') {
        setMemePage(1);
        setHasMore(true);
        fetchMemes(1, false);
      }
    }, 120000); // 2 minutes for trends/memes
    
    return () => {
      clearInterval(coinsInterval);
      clearInterval(trendsInterval);
    };
  }, [fetchTrends, fetchCoins, fetchMemes, activeTab]);

  const filteredTrends = useMemo(() => {
    let t = [...trends];
    if (searchQuery.trim()) t = t.filter(x => (x.topic || '').toLowerCase().includes(searchQuery.toLowerCase()) || (x.ticker || '').toLowerCase().includes(searchQuery.toLowerCase()));
    if (launchFilter === 'hot') t = t.filter(x => x.launchScore >= 65);
    else if (launchFilter === 'cross') t = t.filter(x => x.sourceCount >= 2 || x.crossPlatform);
    else if (launchFilter === 'pop') t = t.filter(x => x.category === 'Entertainment' || x.sources?.wikipedia);
    else if (launchFilter === 'crypto') t = t.filter(x => x.category === 'Crypto' || x.sources?.crypto || x.sources?.dex);
    else if (launchFilter === 'tech') t = t.filter(x => ['Tech', 'AI', 'Gaming'].includes(x.category) || x.sources?.hackernews);
    return t;
  }, [trends, searchQuery, launchFilter]);

  const currentData = activeTab === 'memes' ? memeData : data;
  const filteredData = useMemo(() => {
    // For memes, search in the full cache, not just displayed data
    const dataToFilter = activeTab === 'memes' && searchQuery.trim() ? allMemesCache : currentData;
    let d = [...dataToFilter];
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      d = d.filter(c => 
        (c.name || '').toLowerCase().includes(query) || 
        (c.symbol || '').toLowerCase().includes(query) ||
        (c.id || '').toLowerCase().includes(query)
      );
    }
    
    // Apply filters for coins tab
    if (activeTab === 'all') {
      if (filterNoise) {
        d = d.filter(coin => coin.marketCap >= 10000000); // $10M minimum
      }
      if (!showStablecoins) {
        d = d.filter(coin => !coin.isStablecoin);
      }
    }
    
    // Apply sorting
    if (activeTab === 'all') {
      d.sort((a, b) => {
        let aVal, bVal;
        switch (sortColumn) {
          case 'rank':
            aVal = a.rank || 9999;
            bVal = b.rank || 9999;
            break;
          case 'name':
            aVal = (a.name || '').toLowerCase();
            bVal = (b.name || '').toLowerCase();
            break;
          case 'price':
            aVal = a.price || 0;
            bVal = b.price || 0;
            break;
          case 'priceChange24h':
            aVal = a.priceChange24h || 0;
            bVal = b.priceChange24h || 0;
            break;
          case 'fdv':
            aVal = a.fdv || a.marketCap || 0;
            bVal = b.fdv || b.marketCap || 0;
            break;
          case 'delta':
            aVal = a.delta !== null ? a.delta : -9999;
            bVal = b.delta !== null ? b.delta : -9999;
            break;
          case 'circPercent':
            aVal = a.circPercent !== null ? a.circPercent : -1;
            bVal = b.circPercent !== null ? b.circPercent : -1;
            break;
          default:
            return 0;
        }
        
        if (typeof aVal === 'string') {
          return sortDirection === 'asc' 
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }
        
        return sortDirection === 'asc' 
          ? aVal - bVal
          : bVal - aVal;
      });
    } else {
      // Default sort for memes
      d.sort((a, b) => b.signalScore - a.signalScore);
    }
    
    return d;
  }, [currentData, searchQuery, activeTab, filterNoise, showStablecoins, sortColumn, sortDirection]);
  
  // Handle column sorting
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };
  
  const getSortIcon = (column) => {
    if (sortColumn !== column) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
  };
  
  // Count hidden coins
  const hiddenByNoise = useMemo(() => {
    return data.filter(coin => coin.marketCap < 10000000).length;
  }, [data]);

  const hiddenByStablecoins = useMemo(() => {
    return data.filter(coin => coin.isStablecoin).length;
  }, [data]);

  // Handle refresh button
  const handleRefresh = () => {
    if (activeTab === 'trends') {
    setPage(1);
    setHasMore(true);
    setTrends([]);
    fetchTrends(1, false);
    } else if (activeTab === 'memes') {
      setMemePage(1);
      setHasMore(true);
      setAllMemesCache([]);
      setMemeData([]);
      fetchMemes(1, false);
    }
    fetchCoins();
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#e5e5e5', padding: '20px 16px', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <style>{`
        @media (max-width: 768px) {
          .mobile-hide {
            display: none !important;
          }
          .mobile-stack {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .mobile-full-width {
            width: 100% !important;
            max-width: 100% !important;
          }
        }
      `}</style>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
            <h1 style={{ 
              fontSize: '48px', 
              fontWeight: '700', 
              color: '#171717', 
              margin: 0,
              fontFamily: '"PlayExtraUnlicensed-VAR", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              letterSpacing: '-0.02em',
              textTransform: 'none'
            }}>
              Pulse
          </h1>
          </div>
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

        <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
          {activeTab === 'all' && (
            <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
              {/* Filter Noise Toggle */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#525252'
                }}>
                  <input
                    type="checkbox"
                    checked={filterNoise}
                    onChange={(e) => setFilterNoise(e.target.checked)}
                    style={{ display: 'none' }}
                  />
                  <div style={{
                    width: '44px',
                    height: '24px',
                    borderRadius: '12px',
                    backgroundColor: filterNoise ? '#22c55e' : '#d1d5db',
                    position: 'relative',
                    transition: 'background-color 0.2s',
                    cursor: 'pointer'
                  }} onClick={() => setFilterNoise(!filterNoise)}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: 'white',
                      position: 'absolute',
                      top: '2px',
                      left: filterNoise ? '22px' : '2px',
                      transition: 'left 0.2s',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}></div>
                  </div>
                  <span>Filter Noise ?</span>
                </label>
                <span style={{ fontSize: '12px', color: '#737373', marginLeft: '52px' }}>
                  {hiddenByNoise} hidden
                </span>
              </div>

              {/* Show Stablecoins Toggle */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#525252'
                }}>
                  <input
                    type="checkbox"
                    checked={showStablecoins}
                    onChange={(e) => setShowStablecoins(e.target.checked)}
                    style={{ display: 'none' }}
                  />
                  <div style={{
                    width: '44px',
                    height: '24px',
                    borderRadius: '12px',
                    backgroundColor: showStablecoins ? '#22c55e' : '#d1d5db',
                    position: 'relative',
                    transition: 'background-color 0.2s',
                    cursor: 'pointer'
                  }} onClick={() => setShowStablecoins(!showStablecoins)}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: 'white',
                      position: 'absolute',
                      top: '2px',
                      left: showStablecoins ? '22px' : '2px',
                      transition: 'left 0.2s',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}></div>
                  </div>
                  <span>Show Stablecoins ?</span>
                </label>
                <span style={{ fontSize: '12px', color: '#737373', marginLeft: '52px' }}>
                  {hiddenByStablecoins} hidden
                </span>
              </div>
            </div>
          )}
          
          <div className="mobile-full-width" style={{ position: 'relative', flex: '1', maxWidth: '400px', display: 'flex', marginLeft: 'auto' }}>
            <input 
              type="text" 
              placeholder={activeTab === 'all' ? "Search (e.g. BTC, Pepe)..." : "Search..."} 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              style={{ 
                padding: '10px 14px 10px 36px', 
                borderRadius: '8px', 
                border: '1px solid #e5e5e5', 
                fontSize: '14px', 
                flex: '1', 
                outline: 'none',
                transition: 'border-color 0.2s',
                width: '100%'
              }}
              onFocus={(e) => e.target.style.borderColor = '#2563eb'}
              onBlur={(e) => e.target.style.borderColor = '#e5e5e5'}
            />
            <span style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '16px',
              color: '#9ca3af',
              pointerEvents: 'none'
            }}>🔍</span>
          </div>
          
          {activeTab === 'trends' && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[['all', 'All'], ['hot', '🔥 Hot'], ['cross', '✓ Cross'], ['pop', '🎬 Pop'], ['crypto', '🪙 Crypto'], ['tech', '💻 Tech']].map(([key, label]) => (
                <button key={key} onClick={() => setLaunchFilter(key)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e5e5e5', background: launchFilter === key ? '#171717' : 'white', color: launchFilter === key ? 'white' : '#525252', fontSize: '11px', cursor: 'pointer' }}>{label}</button>
              ))}
            </div>
          )}
          <button onClick={handleRefresh} disabled={trendLoading} style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid #e5e5e5', background: trendLoading ? '#f5f5f5' : 'white', fontSize: '13px', cursor: trendLoading ? 'wait' : 'pointer' }}>{trendLoading ? '⏳...' : '↻ Refresh'}</button>
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
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
                  {filteredTrends.map((t, i) => <TrendCard key={t.topic + i} topic={t} />)}
                </div>
                
                {/* Infinite scroll sentinel & loading indicator */}
                {launchFilter === 'all' && !searchQuery.trim() && (
                  <div ref={loadMoreRef} style={{ padding: '20px', textAlign: 'center' }}>
                    {loadingMore && <LoadingSpinner />}
                    {!hasMore && trends.length > 0 && (
                      <div style={{ color: '#a3a3a3', fontSize: '13px', padding: '20px' }}>
                        ✓ All {totalCount} trends loaded
                      </div>
                    )}
                  </div>
                )}
                
                {/* Show count when filtered */}
                {(launchFilter !== 'all' || searchQuery.trim()) && (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#737373', fontSize: '12px' }}>
                    Showing {filteredTrends.length} of {trends.length} trends
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'all' && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e5e5', overflow: 'visible', position: 'relative' }}>
            {loading && !currentData.length ? <div style={{ padding: '50px', textAlign: 'center', color: '#737373' }}>Loading...</div> : (
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', position: 'relative' }}>
                <style>{`
                  @media (max-width: 768px) {
                    .table-responsive th:nth-child(2),
                    .table-responsive td:nth-child(2) {
                      display: none;
                    }
                    .table-responsive th,
                    .table-responsive td {
                      padding: 12px 8px;
                      font-size: 12px;
                    }
                    .table-responsive th:first-child,
                    .table-responsive td:first-child {
                      padding-left: 12px;
                    }
                    .table-responsive th:last-child,
                    .table-responsive td:last-child {
                      padding-right: 12px;
                    }
                  }
                  @media (max-width: 640px) {
                    .table-responsive th:nth-child(7),
                    .table-responsive td:nth-child(7),
                    .table-responsive th:nth-child(8),
                    .table-responsive td:nth-child(8) {
                      display: none;
                    }
                  }
                `}</style>
                <table className="table-responsive" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#fafafa', borderBottom: '1px solid #e5e5e5' }}>
                      <th 
                        onClick={() => handleSort('rank')}
                        style={{ 
                          padding: '12px 16px', 
                          textAlign: 'left', 
                          fontSize: '11px', 
                          fontWeight: '600', 
                          color: '#737373', 
                          textTransform: 'uppercase', 
                          letterSpacing: '0.05em', 
                          width: '60px',
                          cursor: 'pointer',
                          userSelect: 'none',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                      >
                        # {getSortIcon('rank')}
                      </th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#737373', textTransform: 'uppercase', letterSpacing: '0.05em' }}>^</th>
                      <th 
                        onClick={() => handleSort('name')}
                        style={{ 
                          padding: '12px 16px', 
                          textAlign: 'left', 
                          fontSize: '11px', 
                          fontWeight: '600', 
                          color: '#737373', 
                          textTransform: 'uppercase', 
                          letterSpacing: '0.05em',
                          cursor: 'pointer',
                          userSelect: 'none',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                      >
                        ASSET {getSortIcon('name')}
                      </th>
                      <th 
                        onClick={() => handleSort('price')}
                        style={{ 
                          padding: '12px 16px', 
                          textAlign: 'right', 
                          fontSize: '11px', 
                          fontWeight: '600', 
                          color: '#737373', 
                          textTransform: 'uppercase', 
                          letterSpacing: '0.05em',
                          cursor: 'pointer',
                          userSelect: 'none',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                      >
                        PRICE {getSortIcon('price')}
                      </th>
                      <th 
                        onClick={() => handleSort('priceChange24h')}
                        style={{ 
                          padding: '12px 16px', 
                          textAlign: 'right', 
                          fontSize: '11px', 
                          fontWeight: '600', 
                          color: '#737373', 
                          textTransform: 'uppercase', 
                          letterSpacing: '0.05em',
                          cursor: 'pointer',
                          userSelect: 'none',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                      >
                        24H % {getSortIcon('priceChange24h')}
                      </th>
                      <th 
                        onClick={() => handleSort('fdv')}
                        style={{ 
                          padding: '12px 16px', 
                          textAlign: 'right', 
                          fontSize: '11px', 
                          fontWeight: '600', 
                          color: '#737373', 
                          textTransform: 'uppercase', 
                          letterSpacing: '0.05em',
                          cursor: 'pointer',
                          userSelect: 'none',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                      >
                        FDV {getSortIcon('fdv')}
                      </th>
                      <th 
                        onClick={() => handleSort('delta')}
                        style={{ 
                          padding: '12px 16px', 
                          textAlign: 'center', 
                          fontSize: '11px', 
                          fontWeight: '600', 
                          color: '#737373', 
                          textTransform: 'uppercase', 
                          letterSpacing: '0.05em', 
                          position: 'relative',
                          cursor: 'pointer',
                          userSelect: 'none',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                      >
                        DELTA {getSortIcon('delta')}
                        <span 
                          ref={deltaTooltipRef}
                          style={{ 
                            display: 'inline-block', 
                            marginLeft: '4px', 
                            cursor: 'help', 
                            fontSize: '12px',
                            color: '#9ca3af',
                            position: 'relative',
                            zIndex: 10000
                          }}
                          onMouseEnter={(e) => {
                            e.stopPropagation();
                            setShowDeltaTooltip(true);
                          }}
                          onMouseLeave={(e) => {
                            e.stopPropagation();
                            setShowDeltaTooltip(false);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          ?
                          {showDeltaTooltip && (
                            <div style={{
                              position: 'absolute',
                              bottom: 'calc(100% + 8px)',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              padding: '8px 12px',
                              backgroundColor: '#171717',
                              color: 'white',
                              fontSize: '11px',
                              borderRadius: '6px',
                              whiteSpace: 'nowrap',
                              zIndex: 10001,
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                              pointerEvents: 'none',
                              maxWidth: '250px',
                              lineHeight: '1.4'
                            }}>
                              Rank change from previous update.<br />
                              Positive = moved up, Negative = moved down
                              <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                width: 0,
                                height: 0,
                                borderLeft: '6px solid transparent',
                                borderRight: '6px solid transparent',
                                borderTop: '6px solid #171717'
                              }}></div>
                            </div>
                          )}
                        </span>
                      </th>
                      <th 
                        onClick={() => handleSort('circPercent')}
                        style={{ 
                          padding: '12px 16px', 
                          textAlign: 'right', 
                          fontSize: '11px', 
                          fontWeight: '600', 
                          color: '#737373', 
                          textTransform: 'uppercase', 
                          letterSpacing: '0.05em', 
                          position: 'relative',
                          cursor: 'pointer',
                          userSelect: 'none',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                      >
                        CIRC % {getSortIcon('circPercent')}
                        <span 
                          ref={circTooltipRef}
                          style={{ 
                            display: 'inline-block', 
                            marginLeft: '4px', 
                            cursor: 'help', 
                            fontSize: '12px',
                            color: '#9ca3af',
                            position: 'relative',
                            zIndex: 10000
                          }}
                          onMouseEnter={(e) => {
                            e.stopPropagation();
                            setShowCircTooltip(true);
                          }}
                          onMouseLeave={(e) => {
                            e.stopPropagation();
                            setShowCircTooltip(false);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          ?
                          {showCircTooltip && (
                            <div style={{
                              position: 'absolute',
                              bottom: 'calc(100% + 8px)',
                              right: '0',
                              padding: '8px 12px',
                              backgroundColor: '#171717',
                              color: 'white',
                              fontSize: '11px',
                              borderRadius: '6px',
                              whiteSpace: 'nowrap',
                              zIndex: 10001,
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                              pointerEvents: 'none',
                              textAlign: 'left'
                            }}>
                              Percentage of total supply<br />
                              currently in circulation
                              <div style={{
                                position: 'absolute',
                                top: '100%',
                                right: '12px',
                                width: 0,
                                height: 0,
                                borderLeft: '6px solid transparent',
                                borderRight: '6px solid transparent',
                                borderTop: '6px solid #171717'
                              }}></div>
                            </div>
                          )}
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((coin, index) => {
                      const isPositive = coin.priceChange24h >= 0;
                      const deltaValue = coin.delta !== null && coin.delta !== undefined ? coin.delta : null;
                      const circPercent = coin.circPercent !== null && coin.circPercent !== undefined ? coin.circPercent : null;
                      const circColor = circPercent !== null && circPercent >= 90 ? '#22c55e' : circPercent !== null && circPercent >= 70 ? '#f59e0b' : '#f97316';
                      
                      return (
                        <tr 
                          key={coin.id} 
                          style={{ 
                            borderBottom: '1px solid #f5f5f5',
                            transition: 'background-color 0.1s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fafafa'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <td style={{ padding: '16px', fontSize: '13px', color: '#737373' }}>
                            {coin.rank || index + 1}
                          </td>
                          <td style={{ padding: '16px', fontSize: '13px', color: '#737373' }}>
                            {/* Sort indicator placeholder */}
                          </td>
                          <td style={{ padding: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              {coin.image ? (
                                <img 
                                  src={coin.image} 
                                  alt={coin.name}
                                  style={{ 
                                    width: '32px', 
                                    height: '32px', 
                                    borderRadius: '50%' 
                                  }}
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                backgroundColor: '#f3f4f6',
                                display: coin.image ? 'none' : 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#6b7280'
                              }}>
                                {coin.symbol?.[0] || coin.name?.[0] || '?'}
                              </div>
                              <div>
                                <div style={{ 
                                  fontWeight: '600', 
                                  color: '#171717', 
                                  fontSize: '14px',
                                  marginBottom: '2px'
                                }}>
                                  {coin.name}
                                </div>
                                <div style={{ 
                                  fontSize: '12px', 
                                  color: '#737373' 
                                }}>
                                  {coin.symbol}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ 
                            padding: '16px', 
                            textAlign: 'right', 
                            fontWeight: '500', 
                            fontSize: '14px',
                            color: '#171717'
                          }}>
                            {formatPrice(coin.price)}
                          </td>
                          <td style={{ 
                            padding: '16px', 
                            textAlign: 'right', 
                            fontWeight: '500', 
                            fontSize: '14px',
                            color: isPositive ? '#22c55e' : '#ef4444'
                          }}>
                            {formatPercent(coin.priceChange24h)}
                          </td>
                          <td style={{ padding: '16px', textAlign: 'right' }}>
                            <div style={{ fontSize: '14px', fontWeight: '500', color: '#171717' }}>
                              {formatLargeNumber(coin.fdv || coin.marketCap)}
                            </div>
                            {coin.reportedMarketCap && coin.fdv && Math.abs(coin.reportedMarketCap - coin.fdv) > 1000000 && (
                              <div style={{ fontSize: '11px', color: '#737373', marginTop: '2px' }}>
                                Reported: {formatLargeNumber(coin.reportedMarketCap)}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '16px', textAlign: 'center' }}>
                            {deltaValue !== null && deltaValue !== undefined ? (
                              deltaValue !== 0 ? (
                                <span style={{
                                  display: 'inline-block',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  backgroundColor: deltaValue > 0 ? '#dcfce7' : deltaValue < 0 ? '#fee2e2' : '#f5f5f5',
                                  color: deltaValue > 0 ? '#16a34a' : deltaValue < 0 ? '#dc2626' : '#737373',
                                  fontSize: '12px',
                                  fontWeight: '600'
                                }}>
                                  {deltaValue > 0 ? '+' : ''}{deltaValue}
                                </span>
                              ) : (
                                <span style={{ color: '#9ca3af', fontSize: '12px' }}>0</span>
                              )
                            ) : (
                              <span style={{ color: '#d1d5db', fontSize: '12px' }}>-</span>
                            )}
                          </td>
                          <td style={{ padding: '16px', textAlign: 'right' }}>
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'flex-end',
                              gap: '8px'
                            }}>
                              <span style={{ 
                                fontSize: '13px', 
                                fontWeight: '500',
                                color: '#171717',
                                minWidth: '45px',
                                textAlign: 'right'
                              }}>
                                {circPercent !== null && circPercent !== undefined && !isNaN(circPercent) && circPercent >= 0 ? `${circPercent.toFixed(1)}%` : '-'}
                              </span>
                              {circPercent !== null && circPercent !== undefined && !isNaN(circPercent) && circPercent > 0 && (
                                <div style={{
                                  width: '60px',
                                  height: '6px',
                                  backgroundColor: '#f3f4f6',
                                  borderRadius: '3px',
                                  overflow: 'hidden'
                                }}>
                                  <div style={{
                                    width: `${Math.min(100, Math.max(0, circPercent))}%`,
                                    height: '100%',
                                    backgroundColor: circColor,
                                    transition: 'width 0.3s'
                                  }}></div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                
                {filteredData.length === 0 && (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#737373' }}>
                    No coins found matching your filters.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'memes' && (
          <div style={{ backgroundColor: 'white', borderRadius: '14px', border: '1px solid #e5e5e5', overflow: 'hidden' }}>
            {loading && !currentData.length ? <div style={{ padding: '50px', textAlign: 'center', color: '#737373' }}>Loading...</div> : (
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: '700px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '45px 2fr 1fr 1fr 1fr 1fr 0.8fr', padding: '10px 14px', backgroundColor: '#fafafa', borderBottom: '1px solid #e5e5e5', fontSize: '10px', fontWeight: '600', color: '#737373', textTransform: 'uppercase' }}>
                    <div>#</div><div>Token</div><div style={{ textAlign: 'right' }}>Price</div><div style={{ textAlign: 'right' }}>24h</div><div style={{ textAlign: 'right' }}>Vol</div><div style={{ textAlign: 'right' }}>MCap</div><div style={{ textAlign: 'center' }}>Score</div>
                  </div>
                  {filteredData.map((t, i) => {
                    const isLastItem = i === filteredData.length - 1 && !searchQuery.trim();
                    const viral = getViralLabel(t.viralScore);
                    const chain = getChainBadge(t.chain);
                    return (
                      <div key={t.id + i} style={{ display: 'grid', gridTemplateColumns: '45px 2fr 1fr 1fr 1fr 1fr 0.8fr', padding: '12px 14px', borderBottom: '1px solid #f5f5f5', alignItems: 'center', fontSize: '13px' }}>
                        <div style={{ color: '#a3a3a3', fontSize: '11px' }}>{i + 1}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {t.image ? <img src={t.image} alt="" style={{ width: '26px', height: '26px', borderRadius: '50%' }} onError={e => e.target.style.display='none'} /> : <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600' }}>{t.symbol?.[0]}</div>}
                          <div>
                            <div style={{ fontWeight: '600', color: '#171717', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>{t.name?.slice(0, 14)}{t.chain && <span style={{ backgroundColor: chain.b, color: chain.c, padding: '1px 4px', borderRadius: '3px', fontSize: '8px', fontWeight: '600' }}>{chain.l}</span>}</div>
                            <div style={{ fontSize: '10px', color: '#a3a3a3' }}>{t.symbol}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', fontWeight: '600', fontFamily: 'monospace', fontSize: '12px' }}>{formatPrice(t.price)}</div>
                        <div style={{ textAlign: 'right', fontWeight: '600', color: t.priceChange24h >= 0 ? '#16a34a' : '#dc2626', fontSize: '12px' }}>{formatPercent(t.priceChange24h)}</div>
                        <div style={{ textAlign: 'right', fontSize: '11px', color: '#525252' }}>{formatLargeNumber(t.volume24h)}</div>
                        <div style={{ textAlign: 'right', fontSize: '11px', color: '#525252' }}>{formatLargeNumber(t.marketCap)}</div>
                        <div style={{ textAlign: 'center' }}>
                          <span style={{ backgroundColor: viral.bg, color: viral.color, padding: '3px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: '600' }}>{viral.label}</span>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Infinite scroll sentinel for memes */}
                  {!searchQuery.trim() && (
                    <div ref={loadMoreRef} style={{ padding: '20px', textAlign: 'center' }}>
                      {memeLoadingMore && <div style={{ color: '#737373' }}>Loading more memes...</div>}
                      {!hasMore && filteredData.length > 0 && (
                        <div style={{ color: '#a3a3a3', fontSize: '13px', padding: '20px' }}>
                          ✓ All {allMemesCache.length} meme coins loaded
                </div>
                      )}
              </div>
            )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

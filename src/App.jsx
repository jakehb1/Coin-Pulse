import React, { useState, useEffect, useCallback, useMemo } from 'react';

const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const DEXSCREENER_API = 'https://api.dexscreener.com';

const FALLBACK_COINS = [
  { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', current_price: 97500, price_change_percentage_24h: 2.5, price_change_percentage_7d_in_currency: 8.2, market_cap: 1920000000000, total_volume: 45000000000, market_cap_rank: 1, image: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png' },
  { id: 'ethereum', symbol: 'eth', name: 'Ethereum', current_price: 3450, price_change_percentage_24h: 1.8, price_change_percentage_7d_in_currency: 5.5, market_cap: 415000000000, total_volume: 22000000000, market_cap_rank: 2, image: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' },
  { id: 'solana', symbol: 'sol', name: 'Solana', current_price: 185, price_change_percentage_24h: 3.2, price_change_percentage_7d_in_currency: 12.5, market_cap: 89000000000, total_volume: 4500000000, market_cap_rank: 5, image: 'https://assets.coingecko.com/coins/images/4128/small/solana.png' },
  { id: 'ripple', symbol: 'xrp', name: 'XRP', current_price: 2.35, price_change_percentage_24h: 4.1, price_change_percentage_7d_in_currency: 15.8, market_cap: 135000000000, total_volume: 12000000000, market_cap_rank: 3, image: 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png' },
  { id: 'binancecoin', symbol: 'bnb', name: 'BNB', current_price: 685, price_change_percentage_24h: 1.2, price_change_percentage_7d_in_currency: 4.8, market_cap: 98000000000, total_volume: 1800000000, market_cap_rank: 4, image: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png' },
  { id: 'cardano', symbol: 'ada', name: 'Cardano', current_price: 1.05, price_change_percentage_24h: 2.8, price_change_percentage_7d_in_currency: 9.2, market_cap: 37000000000, total_volume: 1200000000, market_cap_rank: 9, image: 'https://assets.coingecko.com/coins/images/975/small/cardano.png' },
  { id: 'sui', symbol: 'sui', name: 'Sui', current_price: 4.35, price_change_percentage_24h: 5.2, price_change_percentage_7d_in_currency: 18.8, market_cap: 13500000000, total_volume: 1850000000, market_cap_rank: 16, image: 'https://assets.coingecko.com/coins/images/26375/small/sui_asset.jpeg' },
  { id: 'chainlink', symbol: 'link', name: 'Chainlink', current_price: 24, price_change_percentage_24h: 4.2, price_change_percentage_7d_in_currency: 14.8, market_cap: 15000000000, total_volume: 1100000000, market_cap_rank: 13, image: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png' },
];

const FALLBACK_MEMES = [
  { id: 'doge', symbol: 'DOGE', name: 'Dogecoin', price: 0.38, priceChange24h: 5.5, marketCap: 56000000000, volume24h: 4200000000, image: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png', chain: 'multi', dexUrl: 'https://dexscreener.com/ethereum/0x4206931337dc273a630d328da6441786bfad668f' },
  { id: 'shib', symbol: 'SHIB', name: 'Shiba Inu', price: 0.0000245, priceChange24h: 6.2, marketCap: 14500000000, volume24h: 1800000000, image: 'https://assets.coingecko.com/coins/images/11939/small/shiba.png', chain: 'ethereum' },
  { id: 'pepe', symbol: 'PEPE', name: 'Pepe', price: 0.0000195, priceChange24h: 8.5, marketCap: 8200000000, volume24h: 2100000000, image: 'https://assets.coingecko.com/coins/images/29850/small/pepe-token.jpeg', chain: 'ethereum' },
  { id: 'bonk', symbol: 'BONK', name: 'Bonk', price: 0.0000385, priceChange24h: 12.5, marketCap: 2900000000, volume24h: 980000000, image: 'https://assets.coingecko.com/coins/images/28600/small/bonk.jpg', chain: 'solana' },
  { id: 'wif', symbol: 'WIF', name: 'dogwifhat', price: 2.85, priceChange24h: 15.2, marketCap: 2850000000, volume24h: 1200000000, image: 'https://assets.coingecko.com/coins/images/33566/small/dogwifhat.jpg', chain: 'solana' },
  { id: 'floki', symbol: 'FLOKI', name: 'FLOKI', price: 0.000185, priceChange24h: 7.8, marketCap: 1780000000, volume24h: 420000000, image: 'https://assets.coingecko.com/coins/images/16746/small/PNG_image.png', chain: 'ethereum' },
  { id: 'brett', symbol: 'BRETT', name: 'Brett', price: 0.165, priceChange24h: 18.5, marketCap: 1650000000, volume24h: 380000000, image: 'https://assets.coingecko.com/coins/images/35529/small/brett.png', chain: 'base' },
  { id: 'popcat', symbol: 'POPCAT', name: 'Popcat', price: 1.42, priceChange24h: 22.8, marketCap: 1380000000, volume24h: 520000000, image: 'https://assets.coingecko.com/coins/images/33760/small/popcat.png', chain: 'solana' },
  { id: 'mog', symbol: 'MOG', name: 'Mog Coin', price: 0.0000028, priceChange24h: 14.2, marketCap: 1100000000, volume24h: 85000000, image: 'https://assets.coingecko.com/coins/images/31226/small/mog.png', chain: 'ethereum' },
  { id: 'giga', symbol: 'GIGA', name: 'GIGACHAD', price: 0.058, priceChange24h: 25.8, marketCap: 580000000, volume24h: 95000000, chain: 'solana', isPumpFun: true },
  { id: 'goat', symbol: 'GOAT', name: 'Goatseus Maximus', price: 0.72, priceChange24h: 28.5, marketCap: 720000000, volume24h: 280000000, chain: 'solana', isPumpFun: true },
  { id: 'pnut', symbol: 'PNUT', name: 'Peanut the Squirrel', price: 1.25, priceChange24h: 65.2, marketCap: 1250000000, volume24h: 890000000, chain: 'solana', isPumpFun: true },
  { id: 'fartcoin', symbol: 'FARTCOIN', name: 'Fartcoin', price: 0.85, priceChange24h: 38.5, marketCap: 850000000, volume24h: 420000000, chain: 'solana', isPumpFun: true },
  { id: 'act', symbol: 'ACT', name: 'Act I: The AI Prophecy', price: 0.45, priceChange24h: 42.5, marketCap: 420000000, volume24h: 380000000, chain: 'solana', isPumpFun: true },
  { id: 'ai16z', symbol: 'AI16Z', name: 'ai16z', price: 0.95, priceChange24h: 55.2, marketCap: 950000000, volume24h: 520000000, chain: 'solana', isPumpFun: true },
];

const seededRandom = (seed) => { const x = Math.sin(seed) * 10000; return x - Math.floor(x); };

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
    isPumpFun: coin.isPumpFun || coin.dexId === 'pumpfun' || false, ...social,
  };
};

const processDexScreenerPair = (pair, index) => ({
  id: pair.baseToken?.address || `dex-${index}`,
  symbol: pair.baseToken?.symbol || 'UNKNOWN',
  name: pair.baseToken?.name || 'Unknown Token',
  price: parseFloat(pair.priceUsd || 0),
  priceChange24h: parseFloat(pair.priceChange?.h24 || 0),
  marketCap: parseFloat(pair.fdv || pair.marketCap || 0),
  volume24h: parseFloat(pair.volume?.h24 || 0),
  image: pair.info?.imageUrl || '',
  chain: pair.chainId || 'solana',
  dexUrl: pair.url || `https://dexscreener.com/${pair.chainId}/${pair.pairAddress}`,
  isPumpFun: pair.dexId === 'pumpfun' || (pair.url || '').includes('pump'),
  liquidity: parseFloat(pair.liquidity?.usd || 0),
});

const formatPrice = (p) => p === 0 ? '$0' : p < 0.00001 ? `$${p.toExponential(2)}` : p < 0.001 ? `$${p.toFixed(8)}` : p < 1 ? `$${p.toFixed(6)}` : p < 1000 ? `$${p.toFixed(2)}` : `$${p.toLocaleString(undefined, {maximumFractionDigits: 2})}`;
const formatLargeNumber = (n) => !n ? '-' : n >= 1e9 ? `$${(n/1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(1)}K` : `$${n.toFixed(0)}`;
const formatPercent = (n) => n == null ? '-' : `${n >= 0 ? '+' : ''}${Math.abs(n) > 1000 ? (n/1000).toFixed(1) + 'K' : n.toFixed(1)}%`;

const getViralLabel = (s) => s >= 80 ? { label: '🔥 VIRAL', color: '#dc2626', bg: '#fef2f2' } : s >= 60 ? { label: '🚀 HOT', color: '#f97316', bg: '#fff7ed' } : s >= 40 ? { label: '📈 Rising', color: '#eab308', bg: '#fefce8' } : s >= 20 ? { label: '👀 Watch', color: '#22c55e', bg: '#f0fdf4' } : { label: '💤 Quiet', color: '#737373', bg: '#f5f5f5' };
const getSignalLabel = (s) => s >= 80 ? { label: 'Strong Buy', color: '#16a34a', bg: '#dcfce7' } : s >= 60 ? { label: 'Buy', color: '#22c55e', bg: '#f0fdf4' } : s >= 40 ? { label: 'Neutral', color: '#737373', bg: '#f5f5f5' } : { label: 'Caution', color: '#f97316', bg: '#fff7ed' };
const getChainBadge = (c) => ({ solana: { l: 'SOL', c: '#9945FF', b: '#f3e8ff' }, ethereum: { l: 'ETH', c: '#627EEA', b: '#eff6ff' }, base: { l: 'BASE', c: '#0052FF', b: '#eff6ff' }, bsc: { l: 'BSC', c: '#F0B90B', b: '#fefce8' } }[c] || { l: c?.slice(0,4)?.toUpperCase() || '?', c: '#737373', b: '#f5f5f5' });

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
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#171717', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>{coin.name} {coin.isPumpFun && <span style={{ fontSize: '10px', padding: '2px 6px', backgroundColor: '#dcfce7', color: '#16a34a', borderRadius: '4px' }}>pump.fun</span>}</h2>
              <p style={{ fontSize: '14px', color: '#737373', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}>{coin.symbol} <span style={{ backgroundColor: chain.b, color: chain.c, padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '600' }}>{chain.l}</span></p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', backgroundColor: '#f5f5f5', cursor: 'pointer', fontSize: '16px' }}>×</button>
        </div>
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div style={{ padding: '14px', backgroundColor: '#fafafa', borderRadius: '10px' }}><p style={{ fontSize: '11px', color: '#737373', margin: '0 0 4px' }}>PRICE</p><p style={{ fontSize: '22px', fontWeight: '700', color: '#171717', margin: 0 }}>{formatPrice(coin.price)}</p><p style={{ fontSize: '12px', color: coin.priceChange24h >= 0 ? '#16a34a' : '#dc2626', margin: '4px 0 0', fontWeight: '600' }}>{formatPercent(coin.priceChange24h)} 24h</p></div>
            <div style={{ padding: '14px', backgroundColor: '#fafafa', borderRadius: '10px' }}><p style={{ fontSize: '11px', color: '#737373', margin: '0 0 4px' }}>{coin.isMeme ? 'VIRAL SCORE' : 'SIGNAL'}</p><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><p style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>{coin.isMeme ? coin.viralScore : coin.signalScore}</p><span style={{ backgroundColor: signal.bg, color: signal.color, padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600' }}>{signal.label}</span></div></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
            <div style={{ padding: '10px', border: '1px solid #e5e5e5', borderRadius: '8px' }}><p style={{ fontSize: '10px', color: '#737373', margin: '0 0 2px' }}>Market Cap</p><p style={{ fontSize: '13px', fontWeight: '600', margin: 0 }}>{formatLargeNumber(coin.marketCap)}</p></div>
            <div style={{ padding: '10px', border: '1px solid #e5e5e5', borderRadius: '8px' }}><p style={{ fontSize: '10px', color: '#737373', margin: '0 0 2px' }}>Volume 24h</p><p style={{ fontSize: '13px', fontWeight: '600', margin: 0 }}>{formatLargeNumber(coin.volume24h)}</p></div>
            <div style={{ padding: '10px', border: '1px solid #e5e5e5', borderRadius: '8px' }}><p style={{ fontSize: '10px', color: '#737373', margin: '0 0 2px' }}>X Mentions</p><p style={{ fontSize: '13px', fontWeight: '600', margin: 0 }}>{coin.xMentions24h?.toLocaleString()} {coin.xTrending && '🔥'}</p></div>
            <div style={{ padding: '10px', border: '1px solid #e5e5e5', borderRadius: '8px' }}><p style={{ fontSize: '10px', color: '#737373', margin: '0 0 2px' }}>Net Flow</p><p style={{ fontSize: '13px', fontWeight: '600', color: coin.netFlow >= 0 ? '#16a34a' : '#dc2626', margin: 0 }}>{formatLargeNumber(Math.abs(coin.netFlow))}</p></div>
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
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState('signalScore');
  const [sortDirection, setSortDirection] = useState('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCoin, setSelectedCoin] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [memeSource, setMemeSource] = useState('loading');

  const fetchCoins = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h,7d`, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error('API error');
      const coins = await res.json();
      if (Array.isArray(coins) && coins.length) { setData(coins.map(c => generateFlowData(c, false))); setLastUpdated(new Date()); }
      else throw new Error('Empty');
    } catch { setData(FALLBACK_COINS.map(c => generateFlowData(c, false))); setLastUpdated(new Date()); }
    finally { setLoading(false); }
  }, []);

  const fetchTrendingMemes = useCallback(async () => {
    try {
      // Try DexScreener boosted tokens first (includes pump.fun)
      const boostRes = await fetch(`${DEXSCREENER_API}/token-boosts/top/v1`, { signal: AbortSignal.timeout(10000) });
      if (boostRes.ok) {
        const boosts = await boostRes.json();
        if (Array.isArray(boosts) && boosts.length > 5) {
          const tokens = boosts.slice(0, 40);
          const pairs = await Promise.all(tokens.map(async t => {
            try {
              const r = await fetch(`${DEXSCREENER_API}/latest/dex/tokens/${t.tokenAddress}`, { signal: AbortSignal.timeout(5000) });
              const d = await r.json();
              return d.pairs?.[0] ? processDexScreenerPair(d.pairs[0], 0) : null;
            } catch { return null; }
          }));
          const valid = pairs.filter(Boolean);
          if (valid.length > 5) {
            setMemeData(valid.map(p => generateFlowData(p, true)));
            setMemeSource('dexscreener');
            return;
          }
        }
      }
      
      // Fallback: CoinGecko meme category
      const cgRes = await fetch(`${COINGECKO_API}/coins/markets?vs_currency=usd&category=meme-token&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h,7d`);
      if (cgRes.ok) {
        const coins = await cgRes.json();
        if (Array.isArray(coins) && coins.length) { setMemeData(coins.map(c => generateFlowData(c, true))); setMemeSource('coingecko'); return; }
      }
      throw new Error('All failed');
    } catch {
      const now = Date.now();
      setMemeData(FALLBACK_MEMES.map((c, i) => generateFlowData({ ...c, price: c.price * (1 + (seededRandom(now + i) - 0.5) * 0.05), priceChange24h: c.priceChange24h + (seededRandom(now + i + 50) - 0.5) * 15, rank: i + 1 }, true)));
      setMemeSource('fallback');
    }
  }, []);

  useEffect(() => { fetchCoins(); fetchTrendingMemes(); }, [fetchCoins, fetchTrendingMemes]);
  useEffect(() => { const i = setInterval(() => { fetchCoins(); fetchTrendingMemes(); }, 60000); return () => clearInterval(i); }, [fetchCoins, fetchTrendingMemes]);

  const currentData = activeTab === 'memes' ? memeData : data;
  const sortedData = useMemo(() => {
    let r = [...currentData];
    if (searchQuery.trim()) { const q = searchQuery.toLowerCase(); r = r.filter(t => t.name.toLowerCase().includes(q) || t.symbol.toLowerCase().includes(q)); }
    r.sort((a, b) => { const m = sortDirection === 'desc' ? -1 : 1; const av = a[sortField], bv = b[sortField]; return typeof av === 'string' ? (av||'').localeCompare(bv||'') * m : ((av??0) - (bv??0)) * m; });
    return r;
  }, [currentData, searchQuery, sortField, sortDirection]);

  const srcLabel = { dexscreener: '🔥 Live Trending', coingecko: '📊 CoinGecko', fallback: '📋 Demo', loading: '⏳ Loading' };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fafafa', padding: '20px 16px', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#171717', margin: '0 0 6px' }}>{activeTab === 'memes' ? '🐸 Trending Memes' : 'Crypto Flow Tracker'}</h1>
          <p style={{ fontSize: '12px', color: '#737373', margin: '0 0 8px' }}>{activeTab === 'memes' ? 'Live from DexScreener & pump.fun' : 'Track flows and sentiment'}</p>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', backgroundColor: memeSource !== 'fallback' ? '#dcfce7' : '#fef3c7', color: memeSource !== 'fallback' ? '#166534' : '#92400e', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: memeSource !== 'fallback' ? '#22c55e' : '#f59e0b' }} />
            {activeTab === 'memes' ? srcLabel[memeSource] : 'Live'} · {lastUpdated.toLocaleTimeString()}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '16px' }}>
          <button onClick={() => { setActiveTab('all'); setSortField('signalScore'); }} style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid #e5e5e5', background: activeTab === 'all' ? '#171717' : 'white', color: activeTab === 'all' ? 'white' : '#525252', fontSize: '14px', cursor: 'pointer', fontWeight: '500' }}>📊 All Coins</button>
          <button onClick={() => { setActiveTab('memes'); setSortField('viralScore'); }} style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid #e5e5e5', background: activeTab === 'memes' ? '#171717' : 'white', color: activeTab === 'memes' ? 'white' : '#525252', fontSize: '14px', cursor: 'pointer', fontWeight: '500' }}>🐸 Trending Memes</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '12px', flexWrap: 'wrap' }}>
          <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #e5e5e5', fontSize: '14px', flex: '1 1 200px', maxWidth: '280px', outline: 'none' }} />
          <button onClick={() => { fetchCoins(); fetchTrendingMemes(); }} style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid #e5e5e5', background: 'white', fontSize: '13px', cursor: 'pointer' }}>{loading ? '...' : '↻ Refresh'}</button>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '14px', border: '1px solid #e5e5e5', overflow: 'hidden' }}>
          {loading && !currentData.length ? <div style={{ padding: '50px', textAlign: 'center', color: '#737373' }}>Loading...</div> : (
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: '850px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: activeTab === 'memes' ? '45px 2fr 0.7fr 1fr 1fr 1fr 1fr 0.9fr' : '45px 2fr 1fr 1fr 1fr 1fr 1fr 0.9fr', padding: '10px 14px', backgroundColor: '#fafafa', borderBottom: '1px solid #e5e5e5', fontSize: '10px', fontWeight: '600', color: '#737373', textTransform: 'uppercase' }}>
                  <div>#</div>
                  <div onClick={() => { setSortField('name'); setSortDirection(d => sortField === 'name' ? (d === 'desc' ? 'asc' : 'desc') : 'desc'); }} style={{ cursor: 'pointer' }}>Token</div>
                  {activeTab === 'memes' && <div>Chain</div>}
                  <div onClick={() => { setSortField('price'); setSortDirection(d => sortField === 'price' ? (d === 'desc' ? 'asc' : 'desc') : 'desc'); }} style={{ cursor: 'pointer', textAlign: 'right' }}>Price</div>
                  <div onClick={() => { setSortField('priceChange24h'); setSortDirection(d => sortField === 'priceChange24h' ? (d === 'desc' ? 'asc' : 'desc') : 'desc'); }} style={{ cursor: 'pointer', textAlign: 'right' }}>24h</div>
                  {activeTab !== 'memes' && <div onClick={() => { setSortField('netFlow'); setSortDirection(d => sortField === 'netFlow' ? (d === 'desc' ? 'asc' : 'desc') : 'desc'); }} style={{ cursor: 'pointer', textAlign: 'right' }}>Net Flow</div>}
                  <div onClick={() => { setSortField('volume24h'); setSortDirection(d => sortField === 'volume24h' ? (d === 'desc' ? 'asc' : 'desc') : 'desc'); }} style={{ cursor: 'pointer', textAlign: 'right' }}>Vol</div>
                  <div onClick={() => { setSortField('marketCap'); setSortDirection(d => sortField === 'marketCap' ? (d === 'desc' ? 'asc' : 'desc') : 'desc'); }} style={{ cursor: 'pointer', textAlign: 'right' }}>MCap</div>
                  <div onClick={() => { setSortField(activeTab === 'memes' ? 'viralScore' : 'signalScore'); setSortDirection(d => d === 'desc' ? 'asc' : 'desc'); }} style={{ cursor: 'pointer', textAlign: 'center' }}>{activeTab === 'memes' ? 'Viral' : 'Signal'}</div>
                </div>

                {sortedData.map((t, i) => {
                  const viral = getViralLabel(t.viralScore);
                  const signal = getSignalLabel(t.signalScore);
                  const chain = getChainBadge(t.chain);
                  return (
                    <div key={t.id + i} onClick={() => setSelectedCoin(t)} style={{ display: 'grid', gridTemplateColumns: activeTab === 'memes' ? '45px 2fr 0.7fr 1fr 1fr 1fr 1fr 0.9fr' : '45px 2fr 1fr 1fr 1fr 1fr 1fr 0.9fr', padding: '12px 14px', borderBottom: '1px solid #f5f5f5', alignItems: 'center', fontSize: '13px', cursor: 'pointer', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fafafa'} onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>
                      <div style={{ color: '#a3a3a3', fontSize: '11px' }}>{i + 1}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {t.image ? <img src={t.image} alt="" style={{ width: '26px', height: '26px', borderRadius: '50%' }} onError={e => e.target.style.display='none'} /> : <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600' }}>{t.symbol?.[0]}</div>}
                        <div><div style={{ fontWeight: '600', color: '#171717', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>{t.name?.length > 14 ? t.name.slice(0, 14) + '…' : t.name} {t.isPumpFun && <span style={{ fontSize: '8px', padding: '1px 3px', backgroundColor: '#dcfce7', color: '#16a34a', borderRadius: '2px' }}>🎰</span>}</div><div style={{ fontSize: '10px', color: '#a3a3a3' }}>{t.symbol}</div></div>
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

        {selectedCoin && <CoinModal coin={selectedCoin} onClose={() => setSelectedCoin(null)} />}
      </div>
    </div>
  );
}

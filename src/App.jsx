import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

// Utility functions
const formatPrice = (p) => {
  if (!p || p === 0) return '$0';
  if (p < 0.00001) return `$${p.toExponential(2)}`;
  if (p < 0.001) return `$${p.toFixed(8)}`;
  if (p < 1) return `$${p.toFixed(4)}`;
  return `$${p.toLocaleString(undefined, {maximumFractionDigits: 2})}`;
};

const formatLargeNumber = (n) => {
  if (!n || n === 0) return '-';
  if (n >= 1e12) return `$${(n/1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n/1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n/1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n/1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
};

const formatPercent = (n) => {
  if (n == null || n === undefined) return '-';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
};

const formatCircPercent = (n) => {
  if (n == null || n === undefined || isNaN(n)) return '0.0%';
  return `${n.toFixed(1)}%`;
};

export default function App() {
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterNoise, setFilterNoise] = useState(true);
  const [showStablecoins, setShowStablecoins] = useState(false);
  const previousRanksRef = useRef({});
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Fetch coins with full data including supply info
  const fetchCoins = useCallback(async () => {
    try {
      // Fetch market data
      const marketsRes = await fetch(
        `${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h`,
        { signal: AbortSignal.timeout(20000) }
      );
      
      if (!marketsRes.ok) throw new Error(`Markets API: ${marketsRes.status}`);
      
      const marketsData = await marketsRes.json();
      
      // Calculate previous ranks for delta
      const currentRanks = {};
      marketsData.forEach((coin, index) => {
        currentRanks[coin.id] = coin.market_cap_rank || (index + 1);
      });
      
      // Fetch supply data for top coins only (to avoid rate limits)
      // We'll fetch details for top 50 coins in smaller batches
      const topCoinIds = marketsData.slice(0, 50).map(c => c.id);
      const supplyDataMap = new Map();
      
      // Fetch in batches of 10 to avoid rate limits
      for (let i = 0; i < topCoinIds.length; i += 10) {
        const batch = topCoinIds.slice(i, i + 10);
        await Promise.all(
          batch.map(async (id) => {
            try {
              const res = await fetch(
                `${COINGECKO_API}/coins/${id}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`,
                { signal: AbortSignal.timeout(8000) }
              );
      if (res.ok) {
                const data = await res.json();
                supplyDataMap.set(id, {
                  id,
                  totalSupply: data.market_data?.total_supply,
                  circulatingSupply: data.market_data?.circulating_supply,
                  marketCap: data.market_data?.market_cap?.usd
                });
              }
            } catch {}
          })
        );
        // Small delay between batches to avoid rate limits
        if (i + 10 < topCoinIds.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      // Process coins with supply data
      const coinsWithDetails = marketsData.map((coin, index) => {
        const supplyData = supplyDataMap.get(coin.id);
        const circulatingSupply = supplyData?.circulatingSupply || 
          (coin.market_cap && coin.current_price ? coin.market_cap / coin.current_price : null);
        const totalSupply = supplyData?.totalSupply || null;
        const reportedMarketCap = supplyData?.marketCap || coin.market_cap || 0;
        
        // Calculate FDV (Fully Diluted Valuation)
        const fdv = totalSupply && coin.current_price 
          ? totalSupply * coin.current_price 
          : coin.market_cap || 0;
        
        // Calculate Circ %
        const circPercent = totalSupply && circulatingSupply
          ? (circulatingSupply / totalSupply) * 100
          : null;
        
        // Calculate Delta (ranking change)
        const previousRank = previousRanksRef.current[coin.id];
        const currentRank = coin.market_cap_rank || (index + 1);
        const delta = previousRank ? previousRank - currentRank : null;
        
        return {
          id: coin.id,
          symbol: coin.symbol?.toUpperCase() || '',
          name: coin.name || 'Unknown',
          image: coin.image || '',
          price: coin.current_price || 0,
          priceChange24h: coin.price_change_percentage_24h || 0,
          marketCap: coin.market_cap || 0,
          reportedMarketCap: reportedMarketCap,
          fdv: fdv,
          circulatingSupply: circulatingSupply,
          totalSupply: totalSupply,
          circPercent: circPercent,
          rank: currentRank,
          delta: delta,
          volume24h: coin.total_volume || 0,
          // Check if it's a stablecoin
          isStablecoin: ['usdt', 'usdc', 'dai', 'busd', 'tusd', 'usdp', 'usdd', 'frax', 'lusd', 'susd', 'gusd', 'husd', 'ousd', 'usdn', 'usdk', 'usdx', 'usd', 'ust', 'mim'].includes(coin.id?.toLowerCase() || coin.symbol?.toLowerCase() || ''),
        };
      });
      
      // Update previous ranks for next fetch
      previousRanksRef.current = currentRanks;
      
      setCoins(coinsWithDetails);
            setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching coins:', err);
      // Set empty array on error
      setCoins([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchCoins();

    // Auto-refresh every 2 minutes
    const interval = setInterval(() => {
      fetchCoins();
    }, 120000);
    
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter coins based on search and filters
  const filteredCoins = useMemo(() => {
    let filtered = [...coins];
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(coin => 
        coin.name.toLowerCase().includes(query) || 
        coin.symbol.toLowerCase().includes(query) ||
        coin.id.toLowerCase().includes(query)
      );
    }
    
    // Filter noise (low market cap coins)
    if (filterNoise) {
      filtered = filtered.filter(coin => coin.marketCap >= 10000000); // $10M minimum
    }
    
    // Stablecoin filter
    if (!showStablecoins) {
      filtered = filtered.filter(coin => !coin.isStablecoin);
    }
    
    return filtered;
  }, [coins, searchQuery, filterNoise, showStablecoins]);

  // Count hidden coins
  const hiddenByNoise = useMemo(() => {
    return coins.filter(coin => coin.marketCap < 10000000).length;
  }, [coins]);

  const hiddenByStablecoins = useMemo(() => {
    return coins.filter(coin => coin.isStablecoin).length;
  }, [coins]);

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#ffffff', 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      color: '#171717',
      position: 'relative'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px 20px' }}>
        {/* LIVE indicator */}
        <div style={{ 
          position: 'absolute', 
          top: '20px', 
          right: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          zIndex: 10
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#22c55e',
            animation: 'pulse 2s infinite'
          }}></div>
          <span style={{ fontSize: '12px', color: '#525252', fontWeight: '500' }}>LIVE</span>
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
            @media (max-width: 640px) {
              .live-indicator {
                position: relative !important;
                top: auto !important;
                right: auto !important;
                justify-content: center;
                margin-bottom: 16px;
              }
            }
          `}</style>
        </div>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ 
            fontSize: '48px', 
            fontWeight: '700', 
            color: '#171717', 
            margin: '0 0 12px',
            letterSpacing: '-0.02em'
          }}>
            Real Market Cap
          </h1>
          <p style={{ 
            fontSize: '16px', 
            color: '#525252', 
            margin: '0 0 20px',
            lineHeight: '1.5'
          }}>
            I got tired of confusing, half-true crypto rankings — so I built this.
          </p>
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '12px', 
            marginBottom: '16px',
            flexWrap: 'wrap'
          }}>
            <a href="#" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '14px' }}>FDV first</a>
            <span style={{ color: '#d1d5db' }}>|</span>
            <a href="#" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '14px' }}>Useful filters</a>
            <span style={{ color: '#d1d5db' }}>|</span>
            <a href="#" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '14px' }}>Transparent data</a>
          </div>
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            gap: '8px',
            marginBottom: '32px'
          }}>
            <a href="#" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '13px' }}>How's it rank?</a>
            <span style={{ color: '#d1d5db' }}>|</span>
            <span style={{ color: '#737373', fontSize: '13px' }}>made by @nevlyfans</span>
          </div>
        </div>

        {/* Filters and Search */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '24px',
          gap: '20px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
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
                
          {/* Search Bar */}
          <div style={{ position: 'relative', flex: '1', maxWidth: '400px' }}>
            <input
              type="text"
              placeholder="Search (e.g. BTC, Pepe)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px 10px 36px',
                borderRadius: '8px',
                border: '1px solid #e5e5e5',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s'
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
              color: '#9ca3af'
            }}>🔍</span>
                      </div>
                  </div>

        {/* Table */}
        {loading && !coins.length ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#737373' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
            Loading market data...
          </div>
        ) : (
          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '12px', 
            border: '1px solid #e5e5e5',
            overflow: 'hidden'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ 
                    backgroundColor: '#fafafa', 
                    borderBottom: '1px solid #e5e5e5'
                  }}>
                    <th style={{ 
                      padding: '12px 16px', 
                      textAlign: 'left', 
                      fontSize: '11px', 
                      fontWeight: '600', 
                      color: '#737373',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      width: '60px'
                    }}>#</th>
                    <th style={{ 
                      padding: '12px 16px', 
                      textAlign: 'left', 
                      fontSize: '11px', 
                      fontWeight: '600', 
                      color: '#737373',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>^</th>
                    <th style={{ 
                      padding: '12px 16px', 
                      textAlign: 'left', 
                      fontSize: '11px', 
                      fontWeight: '600', 
                      color: '#737373',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>ASSET</th>
                    <th style={{ 
                      padding: '12px 16px', 
                      textAlign: 'right', 
                      fontSize: '11px', 
                      fontWeight: '600', 
                      color: '#737373',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>PRICE</th>
                    <th style={{ 
                      padding: '12px 16px', 
                      textAlign: 'right', 
                      fontSize: '11px', 
                      fontWeight: '600', 
                      color: '#737373',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>24H %</th>
                    <th style={{ 
                      padding: '12px 16px', 
                      textAlign: 'right', 
                      fontSize: '11px', 
                      fontWeight: '600', 
                      color: '#737373',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>FDV</th>
                    <th style={{ 
                      padding: '12px 16px', 
                      textAlign: 'center', 
                      fontSize: '11px', 
                      fontWeight: '600', 
                      color: '#737373',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      position: 'relative'
                    }}>
                      DELTA
                      <span style={{
                        display: 'inline-block',
                        marginLeft: '4px',
                        cursor: 'help',
                        fontSize: '12px'
                      }}>?</span>
                    </th>
                    <th style={{ 
                      padding: '12px 16px', 
                      textAlign: 'right', 
                      fontSize: '11px', 
                      fontWeight: '600', 
                      color: '#737373',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      position: 'relative'
                    }}>
                      CIRC %
                      <span style={{
                        display: 'inline-block',
                        marginLeft: '4px',
                        cursor: 'help',
                        fontSize: '12px'
                      }}>?</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCoins.map((coin, index) => {
                    const isPositive = coin.priceChange24h >= 0;
                    const deltaValue = coin.delta !== null && coin.delta !== 0 ? coin.delta : null;
                    const circPercent = coin.circPercent || 0;
                    const circColor = circPercent >= 90 ? '#22c55e' : circPercent >= 70 ? '#f59e0b' : '#f97316';
                    
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
                            {formatLargeNumber(coin.fdv)}
                          </div>
                          {coin.reportedMarketCap && coin.reportedMarketCap !== coin.fdv && (
                            <div style={{ fontSize: '11px', color: '#737373', marginTop: '2px' }}>
                              Reported: {formatLargeNumber(coin.reportedMarketCap)}
                        </div>
                          )}
                        </td>
                        <td style={{ padding: '16px', textAlign: 'center' }}>
                          {deltaValue !== null ? (
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
                            <span style={{ color: '#d1d5db' }}>-</span>
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
                              {formatCircPercent(circPercent)}
                            </span>
                            <div style={{
                              width: '60px',
                              height: '6px',
                              backgroundColor: '#f3f4f6',
                              borderRadius: '3px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${Math.min(100, circPercent)}%`,
                                height: '100%',
                                backgroundColor: circColor,
                                transition: 'width 0.3s'
                              }}></div>
                        </div>
                      </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
                </div>
            
            {filteredCoins.length === 0 && (
              <div style={{ padding: '40px', textAlign: 'center', color: '#737373' }}>
                No coins found matching your filters.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

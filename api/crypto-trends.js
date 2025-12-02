// Vercel Serverless - CoinGecko Trending Coins (FREE, no auth required)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  try {
    const trendingRes = await fetch('https://api.coingecko.com/api/v3/search/trending', {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!trendingRes.ok) throw new Error(`CoinGecko API returned ${trendingRes.status}`);
    
    const data = await trendingRes.json();
    
    const coins = (data.coins || []).map((item, i) => {
      const c = item.item;
      return {
        id: c.id, name: c.name, symbol: c.symbol?.toUpperCase(), rank: i + 1,
        marketCapRank: c.market_cap_rank, thumb: c.thumb, slug: c.slug, score: c.score,
        data: c.data ? { price: c.data.price, priceChange24h: c.data.price_change_percentage_24h?.usd, marketCap: c.data.market_cap, volume: c.data.total_volume } : null,
      };
    });
    
    const nfts = (data.nfts || []).map((nft, i) => ({
      id: nft.id, name: nft.name, symbol: nft.symbol, rank: i + 1, thumb: nft.thumb,
      floorPrice: nft.data?.floor_price, floorPriceChange24h: nft.data?.floor_price_in_usd_24h_percentage_change,
    }));
    
    const categories = (data.categories || []).map((cat, i) => ({
      id: cat.id, name: cat.name, rank: i + 1, marketCapChange24h: cat.data?.market_cap_change_percentage_24h?.usd,
    }));
    
    res.status(200).json({ success: true, timestamp: new Date().toISOString(), source: 'coingecko', coins, nfts, categories });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, source: 'coingecko' });
  }
}

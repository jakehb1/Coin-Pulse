// Vercel Serverless - GeckoTerminal Trending DEX Pools (FREE public API)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  try {
    const network = req.query.network || 'solana';
    
    const trendingRes = await fetch(`https://api.geckoterminal.com/api/v2/networks/${network}/trending_pools`, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!trendingRes.ok) throw new Error(`GeckoTerminal API returned ${trendingRes.status}`);
    
    const data = await trendingRes.json();
    
    const pools = (data.data || []).map((pool, i) => {
      const a = pool.attributes || {};
      return {
        id: pool.id, rank: i + 1, name: a.name, address: a.address,
        baseToken: { name: a.base_token_name, symbol: a.base_token_symbol, address: a.base_token_address },
        quoteToken: { name: a.quote_token_name, symbol: a.quote_token_symbol },
        price: parseFloat(a.base_token_price_usd) || 0,
        priceChange: { m5: parseFloat(a.price_change_percentage?.m5) || 0, h1: parseFloat(a.price_change_percentage?.h1) || 0, h24: parseFloat(a.price_change_percentage?.h24) || 0 },
        volume24h: parseFloat(a.volume_usd?.h24) || 0,
        txCount24h: parseInt(a.transactions?.h24?.buys || 0) + parseInt(a.transactions?.h24?.sells || 0),
        liquidity: parseFloat(a.reserve_in_usd) || 0,
        fdv: parseFloat(a.fdv_usd) || 0,
        dex: a.dex_id, network,
      };
    });
    
    res.status(200).json({ success: true, timestamp: new Date().toISOString(), source: 'geckoterminal', network, trending: pools });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, source: 'geckoterminal' });
  }
}

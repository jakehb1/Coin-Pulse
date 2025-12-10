// Vercel Serverless - Fetches meme coins from pump.fun
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { limit = '100', offset = '0' } = req.query;
    
    // Pump.fun API endpoint for trending coins
    // Note: This is a public API endpoint - may need to be updated if pump.fun changes their API
    const url = `https://frontend-api.pump.fun/coins?limit=${limit}&offset=${offset}&sort=trending`;
    
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'User-Agent': 'Mozilla/5.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Pump.fun API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Transform pump.fun data to match our format
    const coins = Array.isArray(data) ? data.map(coin => ({
      id: coin.mint || coin.address,
      symbol: coin.symbol || 'UNKNOWN',
      name: coin.name || coin.symbol || 'Unknown',
      price: parseFloat(coin.usd_market_cap ? (coin.usd_market_cap / (coin.raydium?.virtualTokenReserves || 1)) : coin.price_usd || 0),
      priceChange24h: parseFloat(coin.price_change_24h || 0),
      marketCap: parseFloat(coin.usd_market_cap || 0),
      volume24h: parseFloat(coin.volume_24h || 0),
      chain: 'solana',
      image: coin.image_uri || null,
      // Pump.fun specific fields
      complete: coin.complete,
      market_cap_rank: coin.market_cap_rank || 9999
    })) : [];
    
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.status(200).json(coins);
  } catch (error) {
    console.error('Pump.fun API error:', error);
    res.status(500).json({ error: error.message, coins: [] });
  }
}


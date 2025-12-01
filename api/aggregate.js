// Vercel Serverless - Aggregates ALL free trend sources
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  const debug = { errors: [] };
  
  try {
    // Fetch all sources in parallel
    const [hnData, cryptoData, dexData, lemmyData] = await Promise.allSettled([
      fetchHackerNews(),
      fetchCryptoTrending(),
      fetchDexTrending(),
      fetchLemmy(),
    ]);
    
    const hnResult = hnData.status === 'fulfilled' ? hnData.value : { topics: [], topStories: [] };
    const cryptoResult = cryptoData.status === 'fulfilled' ? cryptoData.value : { coins: [] };
    const dexResult = dexData.status === 'fulfilled' ? dexData.value : { trending: [] };
    const lemmyResult = lemmyData.status === 'fulfilled' ? lemmyData.value : { topics: [], topPosts: [] };
    
    debug.hackernews = hnResult.topics?.length || 0;
    debug.crypto = cryptoResult.coins?.length || 0;
    debug.dex = dexResult.trending?.length || 0;
    debug.lemmy = lemmyResult.topics?.length || 0;
    
    if (hnData.status === 'rejected') debug.errors.push(`HN: ${hnData.reason}`);
    if (cryptoData.status === 'rejected') debug.errors.push(`Crypto: ${cryptoData.reason}`);
    if (dexData.status === 'rejected') debug.errors.push(`DEX: ${dexData.reason}`);
    if (lemmyData.status === 'rejected') debug.errors.push(`Lemmy: ${lemmyData.reason}`);
    
    const topicMap = new Map();
    
    // Process Hacker News topics
    for (const t of (hnResult.topics || [])) {
      const key = t.topic.toLowerCase();
      topicMap.set(key, {
        topic: t.topic,
        ticker: '$' + t.topic.toUpperCase().slice(0, 6),
        sources: { hackernews: { mentions: t.mentions, score: t.totalScore, stories: t.stories } },
        category: categorize(t.topic),
      });
    }
    
    // Process Lemmy topics (Reddit alternative)
    for (const t of (lemmyResult.topics || [])) {
      const key = t.topic.toLowerCase();
      if (topicMap.has(key)) {
        const existing = topicMap.get(key);
        existing.sources.lemmy = { mentions: t.mentions, score: t.totalScore, posts: t.posts };
        existing.crossPlatform = true;
      } else {
        topicMap.set(key, {
          topic: t.topic,
          ticker: '$' + t.topic.toUpperCase().slice(0, 6),
          sources: { lemmy: { mentions: t.mentions, score: t.totalScore, posts: t.posts } },
          category: categorize(t.topic),
        });
      }
    }
    
    // Add trending crypto coins
    for (const coin of (cryptoResult.coins || []).slice(0, 10)) {
      const key = coin.name.toLowerCase();
      if (topicMap.has(key)) {
        const existing = topicMap.get(key);
        existing.sources.crypto = { rank: coin.rank, symbol: coin.symbol, price: coin.data?.price, change24h: coin.data?.priceChange24h, thumb: coin.thumb };
        existing.crossPlatform = true;
        existing.category = 'Crypto';
      } else {
        topicMap.set(key, {
          topic: coin.name,
          ticker: '$' + coin.symbol,
          sources: { crypto: { rank: coin.rank, symbol: coin.symbol, price: coin.data?.price, change24h: coin.data?.priceChange24h, thumb: coin.thumb } },
          category: 'Crypto',
        });
      }
    }
    
    // Add trending DEX tokens
    for (const pool of (dexResult.trending || []).slice(0, 10)) {
      const key = pool.baseToken.name.toLowerCase();
      if (!topicMap.has(key)) {
        topicMap.set(key, {
          topic: pool.baseToken.name,
          ticker: '$' + pool.baseToken.symbol,
          sources: { dex: { price: pool.price, change24h: pool.priceChange.h24, volume: pool.volume24h, liquidity: pool.liquidity, dex: pool.dex } },
          category: 'Crypto',
        });
      }
    }
    
    // Calculate scores and sort
    const aggregatedTopics = [];
    for (const [, data] of topicMap) {
      const launchScore = calculateLaunchScore(data);
      aggregatedTopics.push({
        ...data,
        launchScore,
        launchLabel: getLaunchLabel(launchScore),
        velocity: calculateVelocity(data),
      });
    }
    aggregatedTopics.sort((a, b) => b.launchScore - a.launchScore);
    
    // Also return top stories/posts for display
    const topContent = [
      ...(hnResult.topStories || []).slice(0, 10).map(s => ({ ...s, source: 'hackernews' })),
      ...(lemmyResult.topPosts || []).slice(0, 10).map(p => ({ ...p, source: 'lemmy' })),
    ].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 15);
    
    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      sources: {
        hackernews: (hnResult.topics?.length || 0) > 0,
        lemmy: (lemmyResult.topics?.length || 0) > 0,
        crypto: (cryptoResult.coins?.length || 0) > 0,
        dex: (dexResult.trending?.length || 0) > 0,
      },
      topics: aggregatedTopics.slice(0, 30),
      topContent,
      debug,
    });
  } catch (error) {
    console.error('Aggregate error:', error);
    res.status(500).json({ success: false, error: error.message, debug });
  }
}

// Fetch Hacker News
async function fetchHackerNews() {
  const topRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
  const topIds = await topRes.json();
  
  const stories = await Promise.all(
    topIds.slice(0, 30).map(async (id) => {
      try {
        const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        return await r.json();
      } catch { return null; }
    })
  );
  
  const validStories = stories.filter(s => s && s.title && s.score);
  const skipWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'was', 'have', 'been', 'will', 'your', 'from', 'they', 'this', 'that', 'what', 'with', 'how', 'show', 'new']);
  
  const topicCounts = {};
  for (const story of validStories) {
    const words = story.title.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !skipWords.has(w));
    for (const word of words) {
      if (!topicCounts[word]) topicCounts[word] = { mentions: 0, totalScore: 0, stories: [] };
      topicCounts[word].mentions++;
      topicCounts[word].totalScore += story.score || 0;
      if (topicCounts[word].stories.length < 3) {
        topicCounts[word].stories.push({ title: story.title, url: story.url || `https://news.ycombinator.com/item?id=${story.id}`, score: story.score });
      }
    }
  }
  
  const topics = Object.entries(topicCounts)
    .filter(([_, d]) => d.mentions >= 2)
    .map(([topic, d]) => ({ topic, mentions: d.mentions, totalScore: d.totalScore, stories: d.stories }))
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 20);
  
  const topStories = validStories.slice(0, 15).map(s => ({
    id: s.id, title: s.title, url: s.url || `https://news.ycombinator.com/item?id=${s.id}`, score: s.score, comments: s.descendants || 0
  }));
  
  return { topics, topStories };
}

// Fetch CoinGecko trending
async function fetchCryptoTrending() {
  const res = await fetch('https://api.coingecko.com/api/v3/search/trending', { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`CoinGecko: ${res.status}`);
  const data = await res.json();
  
  const coins = (data.coins || []).map((item, i) => {
    const c = item.item;
    return { id: c.id, name: c.name, symbol: c.symbol?.toUpperCase(), rank: i + 1, thumb: c.thumb, data: c.data ? { price: c.data.price, priceChange24h: c.data.price_change_percentage_24h?.usd } : null };
  });
  
  return { coins };
}

// Fetch GeckoTerminal DEX trending
async function fetchDexTrending() {
  const res = await fetch('https://api.geckoterminal.com/api/v2/networks/solana/trending_pools', { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`GeckoTerminal: ${res.status}`);
  const data = await res.json();
  
  const trending = (data.data || []).slice(0, 15).map((pool) => {
    const a = pool.attributes || {};
    return {
      name: a.name,
      baseToken: { name: a.base_token_name, symbol: a.base_token_symbol },
      price: parseFloat(a.base_token_price_usd) || 0,
      priceChange: { h24: parseFloat(a.price_change_percentage?.h24) || 0 },
      volume24h: parseFloat(a.volume_usd?.h24) || 0,
      liquidity: parseFloat(a.reserve_in_usd) || 0,
      dex: a.dex_id,
    };
  });
  
  return { trending };
}

// Fetch Lemmy (Reddit alternative)
async function fetchLemmy() {
  const instances = ['https://lemmy.world', 'https://lemmy.ml'];
  const allPosts = [];
  
  for (const instance of instances) {
    try {
      const response = await fetch(`${instance}/api/v3/post/list?sort=Hot&limit=25&type_=All`, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Pulse/1.0' }
      });
      if (response.ok) {
        const data = await response.json();
        for (const item of (data.posts || [])) {
          const post = item.post;
          const counts = item.counts;
          if (post?.name) {
            allPosts.push({ id: post.id, title: post.name, url: post.url || post.ap_id, community: item.community?.name, score: counts?.score || 0, comments: counts?.comments || 0 });
          }
        }
      }
    } catch {}
  }
  
  const skipWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'was', 'have', 'been', 'will', 'your', 'from', 'they', 'this', 'that', 'what', 'with', 'how']);
  const topicCounts = {};
  
  for (const post of allPosts) {
    const words = post.title.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !skipWords.has(w));
    for (const word of words) {
      if (!topicCounts[word]) topicCounts[word] = { mentions: 0, totalScore: 0, posts: [] };
      topicCounts[word].mentions++;
      topicCounts[word].totalScore += post.score || 0;
      if (topicCounts[word].posts.length < 3) topicCounts[word].posts.push({ title: post.title, url: post.url, score: post.score, community: post.community });
    }
  }
  
  const topics = Object.entries(topicCounts)
    .filter(([_, d]) => d.mentions >= 2)
    .map(([topic, d]) => ({ topic, mentions: d.mentions, totalScore: d.totalScore, posts: d.posts }))
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 20);
  
  return { topics, topPosts: allPosts.slice(0, 15) };
}

function categorize(topic) {
  const t = topic.toLowerCase();
  if (/crypto|bitcoin|btc|ethereum|eth|solana|sol|token|coin|nft|defi|web3/.test(t)) return 'Crypto';
  if (/trump|biden|election|vote|congress|president|political|government/.test(t)) return 'Politics';
  if (/stock|market|fed|rate|economy|inflation|nasdaq|dow|finance/.test(t)) return 'Economics';
  if (/ai|gpt|openai|chatgpt|claude|llm|machine|learning|neural/.test(t)) return 'AI';
  if (/rust|python|javascript|react|code|programming|developer|github|software/.test(t)) return 'Tech';
  if (/game|gaming|steam|playstation|xbox|nintendo/.test(t)) return 'Gaming';
  if (/linux|windows|macos|android|ios|mobile/.test(t)) return 'Tech';
  return 'General';
}

function calculateLaunchScore(data) {
  let score = 0;
  
  // Hacker News weight (tech/AI focused)
  if (data.sources.hackernews) {
    const hnScore = data.sources.hackernews.score || 0;
    score += hnScore >= 500 ? 30 : hnScore >= 200 ? 25 : hnScore >= 100 ? 20 : hnScore >= 50 ? 15 : 10;
    if (data.sources.hackernews.mentions >= 3) score += 5;
  }
  
  // Lemmy weight (community discussions)
  if (data.sources.lemmy) {
    const lemmyScore = data.sources.lemmy.score || 0;
    score += lemmyScore >= 500 ? 25 : lemmyScore >= 200 ? 20 : lemmyScore >= 100 ? 15 : 10;
    if (data.sources.lemmy.mentions >= 3) score += 5;
  }
  
  // Crypto weight (direct market relevance)
  if (data.sources.crypto) {
    const rank = data.sources.crypto.rank || 99;
    score += rank <= 3 ? 35 : rank <= 5 ? 30 : rank <= 10 ? 25 : 15;
  }
  
  // DEX weight (on-chain activity)
  if (data.sources.dex) {
    const volume = data.sources.dex.volume || 0;
    score += volume >= 1000000 ? 30 : volume >= 100000 ? 25 : volume >= 10000 ? 20 : 15;
  }
  
  // Cross-platform bonus
  const sourceCount = Object.keys(data.sources).length;
  if (sourceCount >= 3) score += 20;
  else if (sourceCount >= 2) score += 15;
  
  // Category bonus
  if (data.category === 'Crypto' || data.category === 'AI') score += 5;
  
  return Math.min(100, score);
}

function calculateVelocity(data) {
  let velocity = 50;
  if (data.sources.hackernews?.score >= 200) velocity += 20;
  if (data.sources.lemmy?.score >= 200) velocity += 15;
  if (data.sources.crypto?.rank <= 5) velocity += 25;
  if (data.sources.dex?.volume >= 100000) velocity += 20;
  if (data.crossPlatform) velocity += 10;
  return Math.min(100, velocity);
}

function getLaunchLabel(score) {
  if (score >= 85) return { label: '🚀 LAUNCH NOW', color: '#dc2626' };
  if (score >= 70) return { label: '🔥 HOT', color: '#f97316' };
  if (score >= 55) return { label: '📈 RISING', color: '#eab308' };
  if (score >= 40) return { label: '👀 WATCH', color: '#22c55e' };
  return { label: '🌱 EMERGING', color: '#06b6d4' };
}

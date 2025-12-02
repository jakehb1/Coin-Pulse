// Vercel Serverless - Aggregates ALL free trend sources with cross-referencing
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  const debug = { errors: [] };
  
  try {
    // Fetch all sources in parallel
    const [hnData, cryptoData, dexData, lemmyData, wikiData] = await Promise.allSettled([
      fetchHackerNews(),
      fetchCryptoTrending(),
      fetchDexTrending(),
      fetchLemmy(),
      fetchWikipedia(),
    ]);
    
    const hnResult = hnData.status === 'fulfilled' ? hnData.value : { topics: [], topStories: [] };
    const cryptoResult = cryptoData.status === 'fulfilled' ? cryptoData.value : { coins: [] };
    const dexResult = dexData.status === 'fulfilled' ? dexData.value : { trending: [] };
    const lemmyResult = lemmyData.status === 'fulfilled' ? lemmyData.value : { topics: [], topPosts: [] };
    const wikiResult = wikiData.status === 'fulfilled' ? wikiData.value : { topics: [], trending: [] };
    
    debug.hackernews = hnResult.topics?.length || 0;
    debug.crypto = cryptoResult.coins?.length || 0;
    debug.dex = dexResult.trending?.length || 0;
    debug.lemmy = lemmyResult.topics?.length || 0;
    debug.wikipedia = wikiResult.topics?.length || 0;
    
    if (hnData.status === 'rejected') debug.errors.push(`HN: ${hnData.reason}`);
    if (cryptoData.status === 'rejected') debug.errors.push(`Crypto: ${cryptoData.reason}`);
    if (dexData.status === 'rejected') debug.errors.push(`DEX: ${dexData.reason}`);
    if (lemmyData.status === 'rejected') debug.errors.push(`Lemmy: ${lemmyData.reason}`);
    if (wikiData.status === 'rejected') debug.errors.push(`Wiki: ${wikiData.reason}`);
    
    const topicMap = new Map();
    
    // Helper to normalize topic names for matching
    const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Helper to find existing topic with fuzzy match
    const findExisting = (name) => {
      const norm = normalize(name);
      for (const [key, data] of topicMap) {
        if (normalize(key).includes(norm) || norm.includes(normalize(key))) {
          if (norm.length > 3 && normalize(key).length > 3) return key;
        }
      }
      return null;
    };
    
    // Process Wikipedia topics FIRST (most comprehensive for entertainment/pop culture)
    for (const t of (wikiResult.topics || [])) {
      const key = t.topic.toLowerCase();
      topicMap.set(key, {
        topic: t.topic,
        ticker: '$' + t.topic.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6),
        sources: { wikipedia: { views: t.views, rank: t.rank, heat: t.heat, articles: t.articles?.slice(0, 2) } },
        category: t.category || 'General',
      });
    }
    
    // Process Hacker News topics
    for (const t of (hnResult.topics || [])) {
      const key = t.topic.toLowerCase();
      const existing = findExisting(t.topic) || key;
      
      if (topicMap.has(existing)) {
        const data = topicMap.get(existing);
        data.sources.hackernews = { mentions: t.mentions, score: t.totalScore, stories: t.stories };
        data.crossPlatform = true;
      } else {
        topicMap.set(key, {
          topic: t.topic,
          ticker: '$' + t.topic.toUpperCase().slice(0, 6),
          sources: { hackernews: { mentions: t.mentions, score: t.totalScore, stories: t.stories } },
          category: categorize(t.topic),
        });
      }
    }
    
    // Process Lemmy topics (Reddit alternative)
    for (const t of (lemmyResult.topics || [])) {
      const key = t.topic.toLowerCase();
      const existing = findExisting(t.topic) || key;
      
      if (topicMap.has(existing)) {
        const data = topicMap.get(existing);
        data.sources.lemmy = { mentions: t.mentions, score: t.totalScore, posts: t.posts };
        data.crossPlatform = true;
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
      const existing = findExisting(coin.name);
      
      if (existing && topicMap.has(existing)) {
        const data = topicMap.get(existing);
        data.sources.crypto = { rank: coin.rank, symbol: coin.symbol, price: coin.data?.price, change24h: coin.data?.priceChange24h, thumb: coin.thumb };
        data.crossPlatform = true;
        data.category = 'Crypto';
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
      if (!topicMap.has(key) && !findExisting(pool.baseToken.name)) {
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
      const sourceCount = Object.keys(data.sources).length;
      data.crossPlatform = sourceCount >= 2;
      const launchScore = calculateLaunchScore(data);
      aggregatedTopics.push({
        ...data,
        launchScore,
        launchLabel: getLaunchLabel(launchScore),
        velocity: calculateVelocity(data),
        sourceCount,
      });
    }
    aggregatedTopics.sort((a, b) => b.launchScore - a.launchScore);
    
    // Also return top stories/posts for display
    const topContent = [
      ...(hnResult.topStories || []).slice(0, 8).map(s => ({ ...s, source: 'hackernews' })),
      ...(lemmyResult.topPosts || []).slice(0, 8).map(p => ({ ...p, source: 'lemmy' })),
      ...(wikiResult.trending || []).slice(0, 8).map(w => ({ title: w.title, url: w.url, score: w.views, source: 'wikipedia' })),
    ].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 15);
    
    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      sources: {
        hackernews: (hnResult.topics?.length || 0) > 0,
        lemmy: (lemmyResult.topics?.length || 0) > 0,
        crypto: (cryptoResult.coins?.length || 0) > 0,
        dex: (dexResult.trending?.length || 0) > 0,
        wikipedia: (wikiResult.topics?.length || 0) > 0,
      },
      topics: aggregatedTopics.slice(0, 40),
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

// Fetch Wikipedia Most Read (catches entertainment, movies, TV, celebrities)
async function fetchWikipedia() {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${year}/${month}/${day}`;
  const response = await fetch(url, { headers: { 'User-Agent': 'Pulse/1.0', 'Accept': 'application/json' } });
  
  if (!response.ok) throw new Error(`Wikipedia: ${response.status}`);
  
  const data = await response.json();
  const articles = data.items?.[0]?.articles || [];
  
  // Filter out utility pages
  const skipPatterns = [/^Main_Page$/i, /^Special:/i, /^Wikipedia:/i, /^Portal:/i, /^Deaths_in_/i, /^List_of_/i, /^\d{4}$/, /^[A-Z][a-z]+_\d{1,2}$/, /^Bible$/i, /^Google$/i, /^YouTube$/i, /^Facebook$/i, /^United_States$/i];
  const isSkip = (title) => skipPatterns.some(p => p.test(title));
  
  const trending = articles
    .filter(a => !isSkip(a.article) && a.views > 50000)
    .slice(0, 30)
    .map((a, i) => {
      const title = a.article.replace(/_/g, ' ').replace(/\s*\([^)]+\)\s*/g, '').trim();
      return {
        rank: i + 1,
        topic: title,
        title: a.article.replace(/_/g, ' '),
        views: a.views,
        url: `https://en.wikipedia.org/wiki/${a.article}`,
        category: categorizeWiki(a.article),
        heat: a.views > 1000000 ? 100 : a.views > 500000 ? 85 : a.views > 200000 ? 70 : 55,
      };
    });
  
  return { topics: trending, trending };
}

function categorizeWiki(title) {
  const t = title.toLowerCase();
  if (/\(film\)|\(movie\)|\(tv_series\)|\(series\)|netflix|disney|hbo|marvel/i.test(t)) return 'Entertainment';
  if (/nfl|nba|mlb|premier_league|world_cup|olympics|football|basketball|soccer/i.test(t)) return 'Sports';
  if (/president|election|congress|senate|trump|biden|harris|political/i.test(t)) return 'Politics';
  if (/bitcoin|ethereum|crypto|stock/i.test(t)) return 'Crypto';
  if (/artificial_intelligence|openai|chatgpt/i.test(t)) return 'AI';
  if (/\(singer\)|\(band\)|\(musician\)|\(rapper\)/i.test(t)) return 'Entertainment';
  if (/\(actor\)|\(actress\)/i.test(t)) return 'Entertainment';
  return 'General';
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
  
  // Wikipedia weight (pop culture, entertainment, viral content)
  if (data.sources.wikipedia) {
    const views = data.sources.wikipedia.views || 0;
    const rank = data.sources.wikipedia.rank || 99;
    score += views > 1000000 ? 35 : views > 500000 ? 30 : views > 200000 ? 25 : views > 100000 ? 20 : 15;
    if (rank <= 10) score += 10;
    else if (rank <= 25) score += 5;
  }
  
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
  
  // Cross-platform bonus (THE KEY FEATURE)
  const sourceCount = Object.keys(data.sources).length;
  if (sourceCount >= 4) score += 30;  // Viral across many sources!
  else if (sourceCount >= 3) score += 25;
  else if (sourceCount >= 2) score += 15;
  
  // Category bonus
  if (data.category === 'Crypto' || data.category === 'AI') score += 5;
  if (data.category === 'Entertainment') score += 3; // Pop culture bonus
  
  return Math.min(100, score);
}

function calculateVelocity(data) {
  let velocity = 50;
  if (data.sources.wikipedia?.views >= 500000) velocity += 25;
  else if (data.sources.wikipedia?.views >= 100000) velocity += 15;
  if (data.sources.hackernews?.score >= 200) velocity += 20;
  if (data.sources.lemmy?.score >= 200) velocity += 15;
  if (data.sources.crypto?.rank <= 5) velocity += 25;
  if (data.sources.dex?.volume >= 100000) velocity += 20;
  if (data.crossPlatform) velocity += 15;
  return Math.min(100, velocity);
}

function getLaunchLabel(score) {
  if (score >= 85) return { label: '🚀 LAUNCH NOW', color: '#dc2626' };
  if (score >= 70) return { label: '🔥 HOT', color: '#f97316' };
  if (score >= 55) return { label: '📈 RISING', color: '#eab308' };
  if (score >= 40) return { label: '👀 WATCH', color: '#22c55e' };
  return { label: '🌱 EMERGING', color: '#06b6d4' };
}

// Vercel Serverless Function - Aggregates trends from multiple sources

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  const debug = { errors: [] };
  
  try {
    // Fetch both sources in parallel
    const [googleData, redditData] = await Promise.allSettled([
      fetchGoogleTrends(),
      fetchRedditTrends(),
    ]);
    
    const googleResult = googleData.status === 'fulfilled' ? googleData.value : { trends: [] };
    const redditResult = redditData.status === 'fulfilled' ? redditData.value : { topics: [] };
    
    if (googleData.status === 'rejected') debug.errors.push(`Google: ${googleData.reason}`);
    if (redditData.status === 'rejected') debug.errors.push(`Reddit: ${redditData.reason}`);
    
    debug.googleCount = googleResult?.trends?.length || 0;
    debug.redditCount = redditResult?.topics?.length || 0;
    debug.googleError = googleResult?.error;
    debug.redditError = redditResult?.error;
    
    const topicMap = new Map();
    
    // Process Google Trends
    if (googleResult?.trends?.length) {
      for (const trend of googleResult.trends) {
        const key = trend.topic.toLowerCase().trim();
        topicMap.set(key, {
          topic: trend.topic,
          ticker: '$' + trend.topic.replace(/\s+/g, '').toUpperCase().slice(0, 6),
          sources: { 
            google: { 
              traffic: trend.trafficNumber, 
              trafficFormatted: trend.traffic, 
              articles: trend.articles, 
              image: trend.image 
            } 
          },
          category: categorize(trend.topic, trend.relatedQueries || []),
          firstSeen: trend.date,
        });
      }
    }
    
    // Process Reddit
    if (redditResult?.topics?.length) {
      for (const topic of redditResult.topics) {
        const key = topic.topic.toLowerCase().trim();
        if (topicMap.has(key)) {
          const existing = topicMap.get(key);
          existing.sources.reddit = { 
            mentions: topic.mentions, 
            score: topic.totalScore, 
            comments: topic.totalComments, 
            posts: topic.posts 
          };
          existing.crossPlatform = true;
        } else {
          topicMap.set(key, {
            topic: topic.topic,
            ticker: '$' + topic.topic.toUpperCase().slice(0, 6),
            sources: { 
              reddit: { 
                mentions: topic.mentions, 
                score: topic.totalScore, 
                comments: topic.totalComments, 
                posts: topic.posts 
              } 
            },
            category: categorize(topic.topic, []),
            firstSeen: new Date().toISOString().split('T')[0],
          });
        }
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
        velocity: calculateVelocity(data) 
      });
    }
    aggregatedTopics.sort((a, b) => b.launchScore - a.launchScore);
    
    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      sources: { 
        reddit: (redditResult?.topics?.length || 0) > 0, 
        google: (googleResult?.trends?.length || 0) > 0 
      },
      topics: aggregatedTopics.slice(0, 30),
      debug
    });
  } catch (error) {
    console.error('Aggregate error:', error);
    res.status(500).json({ success: false, error: error.message, debug });
  }
}

// Fetch Google Trends via RSS
async function fetchGoogleTrends() {
  try {
    const rssUrl = 'https://trends.google.com/trends/trendingsearches/daily/rss?geo=US';
    
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      }
    });
    
    if (!response.ok) {
      return { trends: [], error: `RSS HTTP ${response.status}` };
    }
    
    const xml = await response.text();
    const trends = parseRss(xml);
    
    return { trends };
  } catch (error) {
    return { trends: [], error: error.message };
  }
}

function parseRss(xml) {
  const trends = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  
  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    
    const title = extractTag(item, 'title');
    const traffic = extractTag(item, 'ht:approx_traffic');
    const newsItem = extractTag(item, 'ht:news_item_title');
    const newsUrl = extractTag(item, 'ht:news_item_url');
    const newsSource = extractTag(item, 'ht:news_item_source');
    const picture = extractTag(item, 'ht:picture');
    
    if (title) {
      trends.push({
        topic: title,
        traffic: traffic || '0',
        trafficNumber: parseTraffic(traffic || '0'),
        relatedQueries: [],
        articles: newsItem ? [{ title: newsItem, url: newsUrl, source: newsSource }] : [],
        image: picture,
        date: new Date().toISOString().split('T')[0],
      });
    }
  }
  
  return trends;
}

function extractTag(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([^\\]]+)\\]\\]></${tag}>|<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? (match[1] || match[2] || '').trim() : null;
}

// Fetch Reddit trends
async function fetchRedditTrends() {
  try {
    const subreddits = ['popular', 'all', 'wallstreetbets', 'cryptocurrency'];
    const allPosts = [];
    
    for (const sub of subreddits) {
      try {
        const response = await fetch(`https://old.reddit.com/r/${sub}/hot.json?limit=25&raw_json=1`, {
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          for (const post of (data.data?.children || [])) {
            const p = post.data;
            if (p && p.title && !p.stickied && !p.over_18) {
              allPosts.push({
                id: p.id,
                title: p.title,
                subreddit: p.subreddit,
                score: p.score || 0,
                numComments: p.num_comments || 0,
                url: `https://reddit.com${p.permalink}`,
              });
            }
          }
        }
      } catch (e) { 
        console.error(`Reddit r/${sub}:`, e.message);
      }
      await new Promise(r => setTimeout(r, 150));
    }
    
    // Fallback
    if (allPosts.length === 0) {
      for (const sub of ['popular', 'all']) {
        try {
          const response = await fetch(`https://www.reddit.com/r/${sub}.json?limit=25`, {
            headers: { 'User-Agent': 'web:pulse:v1.0 (by /u/pulse_bot)' }
          });
          if (response.ok) {
            const data = await response.json();
            for (const post of (data.data?.children || [])) {
              const p = post.data;
              if (p?.title && !p.stickied) {
                allPosts.push({ id: p.id, title: p.title, subreddit: p.subreddit, score: p.score || 0, numComments: p.num_comments || 0, url: `https://reddit.com${p.permalink}` });
              }
            }
          }
        } catch (e) {}
        await new Promise(r => setTimeout(r, 200));
      }
    }
    
    const skipWords = new Set(['this', 'that', 'with', 'from', 'have', 'just', 'been', 'what', 'when', 'where', 'which', 'would', 'could', 'should', 'about', 'their', 'there', 'these', 'those', 'people', 'like', 'more', 'will', 'they', 'than', 'some', 'your', 'were', 'said', 'into', 'being', 'other', 'after', 'before', 'first', 'also', 'made', 'know', 'think', 'want', 'here', 'most', 'going', 'really', 'still', 'even', 'then', 'only', 'come', 'over', 'take', 'back', 'them', 'very', 'well', 'much', 'need', 'good', 'year', 'time', 'right', 'look', 'work', 'life', 'down', 'world', 'every', 'today', 'never', 'says']);
    
    const topicCounts = {};
    for (const post of allPosts) {
      const words = post.title.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !skipWords.has(w) && !/^\d+$/.test(w));
      for (const word of words) {
        topicCounts[word] = (topicCounts[word] || 0) + 1;
      }
    }
    
    const topics = Object.entries(topicCounts)
      .map(([topic, count]) => {
        const relevantPosts = allPosts.filter(p => p.title.toLowerCase().includes(topic));
        return { topic, mentions: count, totalScore: relevantPosts.reduce((s, p) => s + p.score, 0), totalComments: relevantPosts.reduce((s, p) => s + p.numComments, 0), posts: relevantPosts.slice(0, 3) };
      })
      .filter(t => t.mentions >= 2)
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 25);
    
    return { topics, postCount: allPosts.length };
  } catch (error) {
    return { topics: [], error: error.message };
  }
}

function parseTraffic(traffic) {
  if (!traffic) return 0;
  const str = String(traffic).replace(/[^0-9KMB+.]/gi, '');
  const num = parseFloat(str) || 0;
  if (str.toUpperCase().includes('M')) return num * 1000000;
  if (str.toUpperCase().includes('K')) return num * 1000;
  return num;
}

function categorize(topic, relatedQueries) {
  const combined = [topic.toLowerCase(), ...relatedQueries.map(q => q.toLowerCase())].join(' ');
  if (/crypto|bitcoin|ethereum|solana|token|coin|nft|defi/i.test(combined)) return 'Crypto';
  if (/trump|biden|election|vote|congress|president|republican|democrat|political/i.test(combined)) return 'Politics';
  if (/stock|fed|rate|economy|inflation|market|nasdaq|dow/i.test(combined)) return 'Economics';
  if (/nfl|nba|football|basketball|soccer|game|team|player|sports/i.test(combined)) return 'Sports';
  if (/ai|gpt|openai|chatgpt|claude|robot|llm/i.test(combined)) return 'AI';
  if (/movie|film|netflix|disney|show|actor|series|streaming/i.test(combined)) return 'Entertainment';
  if (/meme|viral|tiktok|trend|funny/i.test(combined)) return 'Meme';
  if (/iphone|apple|google|tech|microsoft|android/i.test(combined)) return 'Tech';
  return 'General';
}

function calculateLaunchScore(data) {
  let score = 0;
  if (data.sources.google) {
    const traffic = data.sources.google.traffic || 0;
    score += traffic >= 1000000 ? 40 : traffic >= 500000 ? 35 : traffic >= 100000 ? 25 : traffic >= 50000 ? 20 : 15;
  }
  if (data.sources.reddit) {
    const redditScore = data.sources.reddit.score || 0;
    score += redditScore >= 50000 ? 30 : redditScore >= 20000 ? 25 : redditScore >= 10000 ? 20 : redditScore >= 5000 ? 15 : 10;
    if (data.sources.reddit.mentions >= 5) score += 5;
  }
  if (Object.keys(data.sources).length >= 2) score += 25;
  return Math.min(100, score);
}

function calculateVelocity(data) {
  let velocity = 50;
  if (data.sources.google?.traffic >= 500000) velocity += 30;
  if (data.sources.reddit?.score >= 10000) velocity += 20;
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

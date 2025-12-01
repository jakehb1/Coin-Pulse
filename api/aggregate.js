// Vercel Serverless Function - Aggregates trends from multiple sources
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : (req.headers.host?.includes('localhost') ? `http://${req.headers.host}` : `https://${req.headers.host}`);
  
  try {
    const [redditRes, googleRes] = await Promise.allSettled([
      fetch(`${baseUrl}/api/reddit`).then(r => r.json()).catch(() => null),
      fetch(`${baseUrl}/api/trends`).then(r => r.json()).catch(() => null),
    ]);
    
    const redditData = redditRes.status === 'fulfilled' ? redditRes.value : null;
    const googleData = googleRes.status === 'fulfilled' ? googleRes.value : null;
    
    const topicMap = new Map();
    
    // Process Google Trends
    if (googleData?.trends) {
      for (const trend of googleData.trends) {
        const key = trend.topic.toLowerCase().trim();
        topicMap.set(key, {
          topic: trend.topic,
          ticker: '$' + trend.topic.replace(/\s+/g, '').toUpperCase().slice(0, 6),
          sources: { google: { traffic: trend.trafficNumber, trafficFormatted: trend.traffic, articles: trend.articles, image: trend.image } },
          category: categorize(trend.topic, trend.relatedQueries || []),
          firstSeen: trend.date,
        });
      }
    }
    
    // Process Reddit
    if (redditData?.topics) {
      for (const topic of redditData.topics) {
        const key = topic.topic.toLowerCase().trim();
        if (topicMap.has(key)) {
          const existing = topicMap.get(key);
          existing.sources.reddit = { mentions: topic.mentions, score: topic.totalScore, comments: topic.totalComments, posts: topic.posts };
          existing.crossPlatform = true;
        } else {
          topicMap.set(key, {
            topic: topic.topic,
            ticker: '$' + topic.topic.toUpperCase().slice(0, 6),
            sources: { reddit: { mentions: topic.mentions, score: topic.totalScore, comments: topic.totalComments, posts: topic.posts } },
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
      aggregatedTopics.push({ ...data, launchScore, launchLabel: getLaunchLabel(launchScore), velocity: calculateVelocity(data) });
    }
    aggregatedTopics.sort((a, b) => b.launchScore - a.launchScore);
    
    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      sources: { reddit: !!redditData?.success, google: !!googleData?.success },
      topics: aggregatedTopics.slice(0, 30),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

function categorize(topic, relatedQueries) {
  const combined = [topic.toLowerCase(), ...relatedQueries.map(q => q.toLowerCase())].join(' ');
  if (/crypto|bitcoin|ethereum|solana|token|coin|nft/i.test(combined)) return 'Crypto';
  if (/trump|biden|election|vote|congress|president/i.test(combined)) return 'Politics';
  if (/stock|fed|rate|economy|inflation/i.test(combined)) return 'Economics';
  if (/nfl|nba|football|basketball|soccer|game/i.test(combined)) return 'Sports';
  if (/ai|gpt|openai|chatgpt|claude/i.test(combined)) return 'AI';
  if (/movie|film|netflix|disney|show/i.test(combined)) return 'Entertainment';
  if (/meme|viral|tiktok|trend/i.test(combined)) return 'Meme';
  if (/iphone|apple|google|tech/i.test(combined)) return 'Tech';
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

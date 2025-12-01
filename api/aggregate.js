// Vercel Serverless Function - Aggregates trends from multiple sources

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  const errors = [];
  
  try {
    // Fetch both sources in parallel
    const [googleData, redditData] = await Promise.allSettled([
      fetchGoogleTrends().catch(e => { errors.push(`Google: ${e.message}`); return { trends: [] }; }),
      fetchRedditTrends().catch(e => { errors.push(`Reddit: ${e.message}`); return { topics: [] }; }),
    ]);
    
    const googleResult = googleData.status === 'fulfilled' ? googleData.value : { trends: [] };
    const redditResult = redditData.status === 'fulfilled' ? redditData.value : { topics: [] };
    
    if (googleData.status === 'rejected') errors.push(`Google rejected: ${googleData.reason}`);
    if (redditData.status === 'rejected') errors.push(`Reddit rejected: ${redditData.reason}`);
    
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
      debug: { 
        googleCount: googleResult?.trends?.length || 0,
        redditCount: redditResult?.topics?.length || 0,
        googleError: googleResult?.error,
        redditError: redditResult?.error,
        errors: errors 
      }
    });
  } catch (error) {
    console.error('Aggregate error:', error);
    res.status(500).json({ success: false, error: error.message, errors: errors });
  }
}

// Fetch Google Trends using direct API call
async function fetchGoogleTrends() {
  try {
    const url = 'https://trends.google.com/trends/api/dailytrends?hl=en-US&tz=360&geo=US&ns=15';
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    
    if (!response.ok) {
      return { trends: [], error: `HTTP ${response.status}` };
    }
    
    let text = await response.text();
    // Remove the ")]}'" prefix that Google adds
    text = text.replace(/^\)\]\}'/, '').trim();
    
    const data = JSON.parse(text);
    const trends = [];
    
    for (const day of (data.default?.trendingSearchesDays || []).slice(0, 2)) {
      for (const search of (day.trendingSearches || [])) {
        const traffic = search.formattedTraffic || '0';
        trends.push({
          topic: search.title?.query || '',
          traffic: traffic,
          trafficNumber: parseTraffic(traffic),
          relatedQueries: (search.relatedQueries || []).map(q => q.query),
          articles: (search.articles || []).slice(0, 2).map(a => ({ 
            title: a.title, 
            source: a.source, 
            url: a.url 
          })),
          image: search.image?.imageUrl,
          date: day.date,
        });
      }
    }
    
    return { trends };
  } catch (error) {
    console.error('Google Trends fetch error:', error);
    return { trends: [], error: error.message };
  }
}

// Fetch Reddit trends directly
async function fetchRedditTrends() {
  try {
    const subreddits = ['popular', 'all', 'memes', 'wallstreetbets'];
    const allPosts = [];
    
    for (const sub of subreddits) {
      try {
        const response = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=25&raw_json=1`, {
          headers: { 
            'User-Agent': 'Mozilla/5.0 (compatible; PulseTrendBot/1.0)',
            'Accept': 'application/json',
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
        console.error(`Reddit r/${sub} error:`, e.message); 
      }
      await new Promise(r => setTimeout(r, 50));
    }
    
    // Aggregate topics
    const skipWords = new Set(['this', 'that', 'with', 'from', 'have', 'just', 'been', 'what', 'when', 'where', 'which', 'would', 'could', 'should', 'about', 'their', 'there', 'these', 'those', 'people', 'like', 'more', 'will', 'they', 'than', 'some', 'your', 'were', 'said', 'into', 'being', 'other', 'after', 'before', 'first', 'also', 'made', 'know', 'think', 'want', 'here', 'most', 'going', 'really', 'still', 'even', 'then', 'only']);
    
    const topicCounts = {};
    for (const post of allPosts) {
      const words = post.title.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !skipWords.has(w));
      
      for (const word of words) {
        topicCounts[word] = (topicCounts[word] || 0) + 1;
      }
    }
    
    const topics = Object.entries(topicCounts)
      .map(([topic, count]) => {
        const relevantPosts = allPosts.filter(p => p.title.toLowerCase().includes(topic));
        return { 
          topic, 
          mentions: count, 
          totalScore: relevantPosts.reduce((sum, p) => sum + p.score, 0),
          totalComments: relevantPosts.reduce((sum, p) => sum + p.numComments, 0),
          posts: relevantPosts.slice(0, 3) 
        };
      })
      .filter(t => t.mentions >= 2 && t.totalScore > 100)
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 25);
    
    return { topics, postCount: allPosts.length };
  } catch (error) {
    console.error('Reddit fetch error:', error);
    return { topics: [], error: error.message };
  }
}

function parseTraffic(traffic) {
  if (!traffic) return 0;
  const str = traffic.replace(/[^0-9KMB+.]/gi, '');
  const num = parseFloat(str);
  if (str.includes('M')) return num * 1000000;
  if (str.includes('K')) return num * 1000;
  return num || 0;
}

function categorize(topic, relatedQueries) {
  const combined = [topic.toLowerCase(), ...relatedQueries.map(q => q.toLowerCase())].join(' ');
  if (/crypto|bitcoin|ethereum|solana|token|coin|nft/i.test(combined)) return 'Crypto';
  if (/trump|biden|election|vote|congress|president|republican|democrat/i.test(combined)) return 'Politics';
  if (/stock|fed|rate|economy|inflation|market/i.test(combined)) return 'Economics';
  if (/nfl|nba|football|basketball|soccer|game|team|player/i.test(combined)) return 'Sports';
  if (/ai|gpt|openai|chatgpt|claude|robot/i.test(combined)) return 'AI';
  if (/movie|film|netflix|disney|show|actor|series/i.test(combined)) return 'Entertainment';
  if (/meme|viral|tiktok|trend|funny/i.test(combined)) return 'Meme';
  if (/iphone|apple|google|tech|microsoft/i.test(combined)) return 'Tech';
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

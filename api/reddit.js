// Vercel Serverless Function - Fetches Reddit trending data
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  try {
    const subreddits = ['all', 'popular', 'memes', 'wallstreetbets', 'cryptocurrency'];
    const allPosts = [];
    
    for (const sub of subreddits.slice(0, 3)) {
      try {
        const response = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=25`, {
          headers: { 'User-Agent': 'Pulse-Trend-Tracker/1.0' }
        });
        
        if (response.ok) {
          const data = await response.json();
          for (const post of (data.data?.children || [])) {
            const p = post.data;
            if (p && p.title && !p.stickied) {
              allPosts.push({
                id: p.id, title: p.title, subreddit: p.subreddit,
                score: p.score || 0, numComments: p.num_comments || 0,
                url: `https://reddit.com${p.permalink}`,
              });
            }
          }
        }
      } catch (e) { console.error(`Error r/${sub}:`, e.message); }
    }
    
    // Aggregate topics
    const topicCounts = {};
    const skipWords = ['this', 'that', 'with', 'from', 'have', 'just', 'been', 'what', 'when', 'where', 'which', 'would', 'could', 'should', 'about', 'their', 'there', 'these', 'those', 'people', 'like', 'more', 'will', 'they', 'than', 'some', 'your', 'were', 'said'];
    
    for (const post of allPosts) {
      const words = post.title.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !skipWords.includes(w));
      for (const word of words) {
        topicCounts[word] = (topicCounts[word] || 0) + 1;
      }
    }
    
    const sortedTopics = Object.entries(topicCounts)
      .map(([topic, count]) => {
        const relevantPosts = allPosts.filter(p => p.title.toLowerCase().includes(topic));
        const totalScore = relevantPosts.reduce((sum, p) => sum + p.score, 0);
        return { topic, mentions: count, totalScore, totalComments: relevantPosts.reduce((sum, p) => sum + p.numComments, 0), posts: relevantPosts.slice(0, 3) };
      })
      .filter(t => t.mentions >= 2)
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 30);
    
    res.status(200).json({ success: true, timestamp: new Date().toISOString(), source: 'reddit', topics: sortedTopics, rawPosts: allPosts.slice(0, 30) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, source: 'reddit' });
  }
}

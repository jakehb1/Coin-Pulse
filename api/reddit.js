// Vercel Serverless Function - Fetches Reddit trending data
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  try {
    const subreddits = ['popular', 'all', 'memes', 'wallstreetbets', 'cryptocurrency', 'solana'];
    const allPosts = [];
    
    // Fetch from multiple subreddits with proper user-agent
    for (const sub of subreddits) {
      try {
        const response = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=25&raw_json=1`, {
          headers: { 
            'User-Agent': 'Mozilla/5.0 (compatible; PulseTrendBot/1.0; +https://pulse-tracker.vercel.app)',
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
                created: p.created_utc,
              });
            }
          }
        }
      } catch (e) { 
        console.error(`Error fetching r/${sub}:`, e.message); 
      }
      
      // Small delay between requests to avoid rate limiting
      await new Promise(r => setTimeout(r, 100));
    }
    
    // Skip common/stop words
    const skipWords = new Set(['this', 'that', 'with', 'from', 'have', 'just', 'been', 'what', 'when', 'where', 'which', 'would', 'could', 'should', 'about', 'their', 'there', 'these', 'those', 'people', 'like', 'more', 'will', 'they', 'than', 'some', 'your', 'were', 'said', 'into', 'being', 'other', 'after', 'before', 'first', 'also', 'made', 'make', 'know', 'think', 'want', 'because', 'here', 'most', 'going', 'really', 'dont', 'cant', 'does', 'didnt', 'getting', 'still', 'even', 'then', 'only', 'come', 'over', 'such', 'take', 'back', 'same', 'them', 'very', 'well', 'much', 'need', 'each', 'good', 'year', 'years', 'time', 'right', 'look', 'work', 'life', 'long', 'down', 'ever', 'little', 'world']);
    
    // Aggregate topics
    const topicCounts = {};
    for (const post of allPosts) {
      const words = post.title.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !skipWords.has(w) && !/^\d+$/.test(w));
      
      for (const word of words) {
        topicCounts[word] = (topicCounts[word] || 0) + 1;
      }
    }
    
    const sortedTopics = Object.entries(topicCounts)
      .map(([topic, count]) => {
        const relevantPosts = allPosts.filter(p => 
          p.title.toLowerCase().includes(topic)
        );
        const totalScore = relevantPosts.reduce((sum, p) => sum + p.score, 0);
        const totalComments = relevantPosts.reduce((sum, p) => sum + p.numComments, 0);
        
        return { 
          topic, 
          mentions: count, 
          totalScore, 
          totalComments,
          posts: relevantPosts.slice(0, 3) 
        };
      })
      .filter(t => t.mentions >= 2 && t.totalScore > 100)
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 30);
    
    res.status(200).json({ 
      success: true, 
      timestamp: new Date().toISOString(), 
      source: 'reddit', 
      topics: sortedTopics, 
      rawPosts: allPosts.slice(0, 30),
      totalPosts: allPosts.length
    });
  } catch (error) {
    console.error('Reddit API error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message, 
      source: 'reddit' 
    });
  }
}

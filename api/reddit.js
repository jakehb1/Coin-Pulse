// Vercel Serverless Function - Fetches Reddit trending data
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  try {
    const subreddits = ['popular', 'all', 'wallstreetbets', 'cryptocurrency', 'memes'];
    const allPosts = [];
    const errors = [];
    
    for (const sub of subreddits) {
      try {
        // Use old.reddit.com which is less likely to block
        const response = await fetch(`https://old.reddit.com/r/${sub}/hot.json?limit=25&raw_json=1`, {
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
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
        } else {
          errors.push(`r/${sub}: ${response.status}`);
        }
      } catch (e) { 
        errors.push(`r/${sub}: ${e.message}`);
      }
      
      await new Promise(r => setTimeout(r, 200));
    }
    
    // Fallback: try www.reddit.com with OAuth-style user agent
    if (allPosts.length === 0) {
      for (const sub of subreddits.slice(0, 3)) {
        try {
          const response = await fetch(`https://www.reddit.com/r/${sub}.json?limit=25`, {
            headers: { 
              'User-Agent': 'web:pulse-tracker:v1.0.0 (by /u/pulse_tracker_bot)',
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            for (const post of (data.data?.children || [])) {
              const p = post.data;
              if (p && p.title && !p.stickied) {
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
          } else {
            errors.push(`www r/${sub}: ${response.status}`);
          }
        } catch (e) { 
          errors.push(`www r/${sub}: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 300));
      }
    }
    
    // Skip common words
    const skipWords = new Set(['this', 'that', 'with', 'from', 'have', 'just', 'been', 'what', 'when', 'where', 'which', 'would', 'could', 'should', 'about', 'their', 'there', 'these', 'those', 'people', 'like', 'more', 'will', 'they', 'than', 'some', 'your', 'were', 'said', 'into', 'being', 'other', 'after', 'before', 'first', 'also', 'made', 'make', 'know', 'think', 'want', 'because', 'here', 'most', 'going', 'really', 'dont', 'cant', 'does', 'getting', 'still', 'even', 'then', 'only', 'come', 'over', 'take', 'back', 'same', 'them', 'very', 'well', 'much', 'need', 'each', 'good', 'year', 'years', 'time', 'right', 'look', 'work', 'life', 'long', 'down', 'ever', 'world', 'every', 'today', 'never', 'says', 'told']);
    
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
        const relevantPosts = allPosts.filter(p => p.title.toLowerCase().includes(topic));
        const totalScore = relevantPosts.reduce((sum, p) => sum + p.score, 0);
        const totalComments = relevantPosts.reduce((sum, p) => sum + p.numComments, 0);
        
        return { topic, mentions: count, totalScore, totalComments, posts: relevantPosts.slice(0, 3) };
      })
      .filter(t => t.mentions >= 2)
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 30);
    
    res.status(200).json({ 
      success: true, 
      timestamp: new Date().toISOString(), 
      source: 'reddit', 
      topics: sortedTopics, 
      rawPosts: allPosts.slice(0, 30),
      totalPosts: allPosts.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, source: 'reddit' });
  }
}

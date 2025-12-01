// Vercel Serverless - Lemmy Hot Posts (FREE, no auth required for reading)
// Lemmy is a federated Reddit alternative
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  try {
    // Try multiple Lemmy instances
    const instances = [
      'https://lemmy.world',
      'https://lemmy.ml',
      'https://sh.itjust.works',
      'https://programming.dev',
    ];
    
    const allPosts = [];
    const errors = [];
    
    for (const instance of instances) {
      try {
        const response = await fetch(`${instance}/api/v3/post/list?sort=Hot&limit=25&type_=All`, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Pulse-Trend-Tracker/1.0',
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          for (const item of (data.posts || [])) {
            const post = item.post;
            const counts = item.counts;
            if (post && post.name) {
              allPosts.push({
                id: post.id,
                title: post.name,
                url: post.url || post.ap_id,
                body: post.body?.slice(0, 200),
                community: item.community?.name || 'unknown',
                instance: new URL(instance).hostname,
                score: counts?.score || 0,
                upvotes: counts?.upvotes || 0,
                comments: counts?.comments || 0,
                published: post.published,
              });
            }
          }
        } else {
          errors.push(`${instance}: ${response.status}`);
        }
      } catch (e) {
        errors.push(`${instance}: ${e.message}`);
      }
    }
    
    // Deduplicate by title similarity
    const seen = new Set();
    const uniquePosts = allPosts.filter(p => {
      const key = p.title.toLowerCase().slice(0, 50);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    // Sort by score
    uniquePosts.sort((a, b) => b.score - a.score);
    
    // Extract trending topics
    const skipWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'was', 'one', 'our', 'has', 'have', 'been', 'will', 'your', 'from', 'they', 'this', 'that', 'what', 'with', 'how', 'why', 'who', 'when', 'where', 'which', 'their', 'about', 'into', 'than', 'then', 'them', 'these', 'some', 'would', 'there', 'could', 'other', 'more', 'just', 'over', 'also', 'back', 'most', 'here', 'much']);
    
    const topicCounts = {};
    for (const post of uniquePosts) {
      const words = post.title.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !skipWords.has(w));
      for (const word of words) {
        if (!topicCounts[word]) topicCounts[word] = { mentions: 0, totalScore: 0, posts: [] };
        topicCounts[word].mentions++;
        topicCounts[word].totalScore += post.score || 0;
        if (topicCounts[word].posts.length < 3) {
          topicCounts[word].posts.push({ title: post.title, url: post.url, score: post.score, community: post.community });
        }
      }
    }
    
    const topics = Object.entries(topicCounts)
      .filter(([_, d]) => d.mentions >= 2)
      .map(([topic, d]) => ({ topic, mentions: d.mentions, totalScore: d.totalScore, posts: d.posts }))
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 25);
    
    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      source: 'lemmy',
      topics,
      topPosts: uniquePosts.slice(0, 20),
      totalFetched: uniquePosts.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, source: 'lemmy' });
  }
}

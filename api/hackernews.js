// Vercel Serverless - Hacker News Trending Topics (FREE, no auth required)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  try {
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
    
    const skipWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'was', 'one', 'our', 'has', 'have', 'been', 'will', 'your', 'from', 'they', 'this', 'that', 'what', 'with', 'how', 'why', 'who', 'when', 'where', 'which', 'their', 'about', 'into', 'than', 'then', 'them', 'these', 'some', 'would', 'there', 'could', 'other', 'more', 'just', 'over', 'also', 'back', 'most', 'here', 'much', 'using', 'show', 'new']);
    
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
      .slice(0, 25);
    
    const topStories = validStories.slice(0, 20).map(s => ({
      id: s.id, title: s.title, url: s.url || `https://news.ycombinator.com/item?id=${s.id}`, score: s.score, comments: s.descendants || 0
    }));
    
    res.status(200).json({ success: true, timestamp: new Date().toISOString(), source: 'hackernews', topics, topStories, totalFetched: validStories.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, source: 'hackernews' });
  }
}

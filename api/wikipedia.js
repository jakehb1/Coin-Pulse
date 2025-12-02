// Vercel Serverless - Wikipedia Most Read Articles (FREE, no auth)
// Catches entertainment, movies, TV shows, celebrities - exactly what's viral RIGHT NOW
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  try {
    // Get yesterday's date (today's data not always available yet)
    const now = new Date();
    now.setDate(now.getDate() - 1);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${year}/${month}/${day}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Pulse-Trend-Tracker/1.0 (trend detection app)',
        'Accept': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error(`Wikipedia API returned ${response.status}`);
    }
    
    const data = await response.json();
    const articles = data.items?.[0]?.articles || [];
    
    // Filter out boring/utility pages
    const skipPatterns = [
      /^Main_Page$/i,
      /^Special:/i,
      /^Wikipedia:/i,
      /^Portal:/i,
      /^File:/i,
      /^Help:/i,
      /^Category:/i,
      /^Template:/i,
      /^User:/i,
      /^Talk:/i,
      /^Deaths_in_\d{4}$/i,
      /^List_of_/i,
      /^\d{4}$/,  // Just years
      /^[A-Z][a-z]+_\d{1,2}$/,  // Dates like "December_1"
      /^Bible$/i,
      /^Google$/i,
      /^YouTube$/i,
      /^Facebook$/i,
      /^ChatGPT$/i,
      /^United_States$/i,
      /^India$/i,
      /^Pornhub$/i,
      /^XNXX$/i,
      /^XVideos$/i,
      /^XXX/i,
    ];
    
    const isSkip = (title) => skipPatterns.some(p => p.test(title));
    
    // Categorize articles
    const categorize = (title) => {
      const t = title.toLowerCase().replace(/_/g, ' ');
      
      // Movies/TV
      if (/\(film\)|\(movie\)|\(tv series\)|\(tv_series\)|\(series\)|\(miniseries\)/i.test(title)) return 'Entertainment';
      if (/season \d|episode/i.test(t)) return 'Entertainment';
      if (/stranger things|netflix|disney|hbo|marvel|dc |star wars/i.test(t)) return 'Entertainment';
      
      // Sports
      if (/nfl|nba|mlb|premier league|world cup|olympics|football|basketball|soccer|cricket|tennis/i.test(t)) return 'Sports';
      if (/super bowl|championship|playoffs|match|game \d/i.test(t)) return 'Sports';
      
      // Politics
      if (/president|election|congress|senate|governor|minister|trump|biden|harris|political/i.test(t)) return 'Politics';
      
      // Crypto/Finance
      if (/bitcoin|ethereum|crypto|stock|nasdaq|dow|sp 500|financial/i.test(t)) return 'Crypto';
      
      // Tech/AI
      if (/artificial intelligence|machine learning|openai|chatgpt|ai |tech|software|apple|google|microsoft/i.test(t)) return 'AI';
      
      // Music
      if (/\(singer\)|\(band\)|\(musician\)|\(rapper\)|album|song|music|concert|tour/i.test(t)) return 'Entertainment';
      
      // Celebrity
      if (/\(actor\)|\(actress\)|\(model\)|\(celebrity\)/i.test(t)) return 'Entertainment';
      
      return 'General';
    };
    
    // Process articles
    const trending = articles
      .filter(a => !isSkip(a.article) && a.views > 50000)
      .slice(0, 50)
      .map((a, i) => {
        const title = a.article.replace(/_/g, ' ');
        return {
          rank: i + 1,
          title: title,
          article: a.article,
          views: a.views,
          url: `https://en.wikipedia.org/wiki/${a.article}`,
          category: categorize(a.article),
          // Calculate "heat" score based on views
          heat: a.views > 1000000 ? 100 : a.views > 500000 ? 85 : a.views > 200000 ? 70 : a.views > 100000 ? 55 : 40,
        };
      });
    
    // Extract keywords/topics from trending articles
    const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'was', 'one', 'our', 'has', 'have', 'been', 'will', 'your', 'from', 'they', 'this', 'that', 'what', 'with', 'how', 'why', 'who', 'when', 'where', 'which', 'their', 'about', 'into', 'than', 'then', 'them', 'these', 'some', 'would', 'there', 'could', 'other', 'more', 'just', 'over', 'also', 'back', 'most', 'here', 'much', 'film', 'series', 'actor', 'actress', 'singer', 'band', 'american', 'born', 'died', 'episode', 'season']);
    
    const topicMap = {};
    for (const article of trending) {
      // Use the clean title as a topic itself
      const cleanTitle = article.title.replace(/\s*\([^)]+\)\s*/g, '').trim();
      if (cleanTitle.length > 2) {
        if (!topicMap[cleanTitle.toLowerCase()]) {
          topicMap[cleanTitle.toLowerCase()] = {
            topic: cleanTitle,
            views: 0,
            articles: [],
            category: article.category,
          };
        }
        topicMap[cleanTitle.toLowerCase()].views += article.views;
        topicMap[cleanTitle.toLowerCase()].articles.push(article);
      }
    }
    
    const topics = Object.values(topicMap)
      .sort((a, b) => b.views - a.views)
      .slice(0, 30)
      .map((t, i) => ({
        ...t,
        rank: i + 1,
        heat: t.views > 1000000 ? 100 : t.views > 500000 ? 85 : t.views > 200000 ? 70 : t.views > 100000 ? 55 : 40,
      }));
    
    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      source: 'wikipedia',
      date: `${year}-${month}-${day}`,
      trending: trending.slice(0, 30),
      topics,
      totalArticles: articles.length,
    });
  } catch (error) {
    console.error('Wikipedia API error:', error);
    res.status(500).json({ success: false, error: error.message, source: 'wikipedia' });
  }
}

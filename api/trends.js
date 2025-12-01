// Vercel Serverless Function - Fetches Google Trends data using direct API

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  try {
    const geo = req.query.geo || 'US';
    const url = `https://trends.google.com/trends/api/dailytrends?hl=en-US&tz=360&geo=${geo}&ns=15`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    
    if (!response.ok) {
      return res.status(response.status).json({ 
        success: false, 
        error: `Google API returned ${response.status}`,
        source: 'google_trends' 
      });
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
            url: a.url, 
            image: a.image?.imageUrl 
          })),
          image: search.image?.imageUrl,
          date: day.date,
        });
      }
    }
    
    res.status(200).json({ 
      success: true, 
      timestamp: new Date().toISOString(), 
      source: 'google_trends', 
      geo, 
      trends: trends.slice(0, 25) 
    });
  } catch (error) {
    console.error('Google Trends error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message, 
      source: 'google_trends' 
    });
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

// Vercel Serverless Function - Fetches Google Trends via RSS
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  try {
    const geo = req.query.geo || 'US';
    
    // Try the RSS feed first (more reliable)
    const rssUrl = `https://trends.google.com/trends/trendingsearches/daily/rss?geo=${geo}`;
    
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      }
    });
    
    if (!response.ok) {
      // Fallback: try the JSON API with different params
      return await tryJsonApi(req, res, geo);
    }
    
    const xml = await response.text();
    const trends = parseRss(xml);
    
    if (trends.length === 0) {
      return await tryJsonApi(req, res, geo);
    }
    
    res.status(200).json({ 
      success: true, 
      timestamp: new Date().toISOString(), 
      source: 'google_trends_rss', 
      geo, 
      trends: trends.slice(0, 25) 
    });
  } catch (error) {
    console.error('Google Trends error:', error);
    res.status(500).json({ success: false, error: error.message, source: 'google_trends' });
  }
}

async function tryJsonApi(req, res, geo) {
  try {
    // Try multiple endpoint variations
    const endpoints = [
      `https://trends.google.com/trends/api/dailytrends?hl=en-US&tz=360&geo=${geo}&ns=15`,
      `https://trends.google.com/trends/api/dailytrends?hl=en&geo=${geo}`,
    ];
    
    for (const url of endpoints) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://trends.google.com/trends/trendingsearches/daily',
          }
        });
        
        if (response.ok) {
          let text = await response.text();
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
                  title: a.title, source: a.source, url: a.url 
                })),
                date: day.date,
              });
            }
          }
          
          if (trends.length > 0) {
            return res.status(200).json({ 
              success: true, 
              timestamp: new Date().toISOString(), 
              source: 'google_trends_json', 
              geo, 
              trends 
            });
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    res.status(200).json({ success: true, trends: [], source: 'google_trends', error: 'No data available' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, source: 'google_trends' });
  }
}

function parseRss(xml) {
  const trends = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  
  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    
    const title = extractTag(item, 'title');
    const traffic = extractTag(item, 'ht:approx_traffic') || extractTag(item, 'ht:traffic');
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

function parseTraffic(traffic) {
  if (!traffic) return 0;
  const str = String(traffic).replace(/[^0-9KMB+.]/gi, '');
  const num = parseFloat(str) || 0;
  if (str.toUpperCase().includes('M')) return num * 1000000;
  if (str.toUpperCase().includes('K')) return num * 1000;
  return num;
}

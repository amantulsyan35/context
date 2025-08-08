const https = require('https');

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      },
      body: ''
    };
  }

  const { videoId, startTime, endTime } = event.queryStringParameters || {};
  
  if (!videoId || !startTime || !endTime) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Missing required parameters: videoId, startTime, endTime' })
    };
  }

  const start = parseFloat(startTime);
  const end = parseFloat(endTime);

  try {
    console.log(`Fetching transcript for video ${videoId} from ${start}s to ${end}s`);
    
    // Fetch YouTube page
    const html = await fetchUrl(`https://www.youtube.com/watch?v=${videoId}`);
    
    // Extract caption tracks from the page
    const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
    if (!captionMatch) {
      console.log('No caption tracks found');
      return {
        statusCode: 200,
        headers: { 
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*'
        },
        body: ''
      };
    }

    let captionTracks;
    try {
      captionTracks = JSON.parse(captionMatch[1]);
    } catch (e) {
      console.error('Failed to parse caption tracks JSON:', e);
      return {
        statusCode: 200,
        headers: { 
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*'
        },
        body: ''
      };
    }

    // Find English captions
    const englishTrack = captionTracks.find(track => 
      track.languageCode === 'en' || track.languageCode.startsWith('en')
    );

    if (!englishTrack) {
      console.log('No English captions found');
      return {
        statusCode: 200,
        headers: { 
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*'
        },
        body: ''
      };
    }

    console.log('Found English captions, fetching subtitle XML...');

    // Fetch subtitle XML
    const subtitleXml = await fetchUrl(englishTrack.baseUrl);
    
    // Parse XML and extract relevant text
    const clipSubtitles = parseSubtitles(subtitleXml, start, end);
    
    console.log(`Found ${clipSubtitles.length} subtitle segments`);
    
    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      },
      body: clipSubtitles.join(' ')
    };

  } catch (error) {
    console.error('Error fetching transcript:', error);
    return {
      statusCode: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Failed to fetch transcript', details: error.message })
    };
  }
};

// Helper function to fetch URL content
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Helper function to parse subtitles XML
function parseSubtitles(xml, startTime, endTime) {
  const clipSubtitles = [];
  
  // Simple regex to extract text elements with timing
  const textRegex = /<text[^>]*start="([^"]*)"[^>]*(?:dur="([^"]*)")?[^>]*>(.*?)<\/text>/g;
  let match;
  
  while ((match = textRegex.exec(xml)) !== null) {
    const textStart = parseFloat(match[1]);
    const duration = match[2] ? parseFloat(match[2]) : 4; // Default 4 second duration
    const textEnd = textStart + duration;
    const rawText = match[3];
    
    // Check if this subtitle overlaps with our clip time range
    if ((textStart >= startTime && textStart <= endTime) || 
        (textEnd >= startTime && textEnd <= endTime) ||
        (textStart <= startTime && textEnd >= endTime)) {
      
      // Clean up the text
      let cleanText = rawText
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/<[^>]*>/g, '') // Remove any HTML tags
        .trim();
      
      if (cleanText) {
        clipSubtitles.push(cleanText);
      }
    }
  }
  
  return clipSubtitles;
}
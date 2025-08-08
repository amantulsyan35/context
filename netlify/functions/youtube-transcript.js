exports.handler = async (event, context) => {
  const { videoId, startTime, endTime } = event.queryStringParameters;
  
  if (!videoId || !startTime || !endTime) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required parameters' })
    };
  }

  const start = parseFloat(startTime);
  const end = parseFloat(endTime);

  try {
    // Use the youtube-transcript package server-side to avoid CORS
    // First try to install it: npm install youtube-transcript
    
    // For now, we'll use a simple approach
    const https = require('https');
    const { URL } = require('url');

    // Fetch YouTube page server-side
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    const response = await new Promise((resolve, reject) => {
      const req = https.get(videoUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve({ ok: res.statusCode === 200, text: () => data }));
      });
      req.on('error', reject);
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Timeout'));
      });
    });

    if (!response.ok) {
      throw new Error('Failed to fetch video page');
    }

    const html = response.text();
    
    // Extract caption tracks
    const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
    if (!captionMatch) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/plain' },
        body: '' // No captions available
      };
    }

    const captionTracks = JSON.parse(captionMatch[1]);
    const englishTrack = captionTracks.find(track => 
      track.languageCode === 'en' || track.languageCode.startsWith('en')
    );

    if (!englishTrack) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/plain' },
        body: ''
      };
    }

    // Fetch subtitle XML
    const subtitleResponse = await new Promise((resolve, reject) => {
      const req = https.get(englishTrack.baseUrl, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve({ ok: res.statusCode === 200, text: () => data }));
      });
      req.on('error', reject);
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Timeout'));
      });
    });

    if (!subtitleResponse.ok) {
      throw new Error('Failed to fetch subtitles');
    }

    const subtitleXml = subtitleResponse.text();
    
    // Parse XML (simple approach for Node.js)
    const textMatches = subtitleXml.match(/<text[^>]*start="([^"]*)"[^>]*dur="([^"]*)"[^>]*>(.*?)<\/text>/g) || [];
    
    const clipSubtitles = [];
    
    for (const match of textMatches) {
      const startMatch = match.match(/start="([^"]*)"/);
      const durMatch = match.match(/dur="([^"]*)"/);
      const textMatch = match.match(/>(.*?)<\/text>/);
      
      if (startMatch && textMatch) {
        const textStart = parseFloat(startMatch[1]);
        const duration = durMatch ? parseFloat(durMatch[1]) : 0;
        const textEnd = textStart + duration;
        
        // Check if this subtitle overlaps with our clip time range
        if ((textStart >= start && textStart <= end) || 
            (textEnd >= start && textEnd <= end) ||
            (textStart <= start && textEnd >= end)) {
          
          let text = textMatch[1]
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim();
          
          if (text) {
            clipSubtitles.push(text);
          }
        }
      }
    }
    
    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*'
      },
      body: clipSubtitles.join(' ')
    };

  } catch (error) {
    console.error('Error fetching transcript:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to fetch transcript' })
    };
  }
};
const https = require('https');

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
      body: '',
    };
  }

  const { videoId, startTime, endTime } = event.queryStringParameters || {};
  if (!videoId || !startTime || !endTime) {
    return json(400, { error: 'Missing required parameters: videoId, startTime, endTime' });
  }

  const start = parseFloat(startTime);
  const end = parseFloat(endTime);

  try {
    // 1) Fetch the YouTube watch HTML
    const html = await fetchUrl(`https://www.youtube.com/watch?v=${videoId}`);

    // 2) Extract captionTracks JSON
    const captionMatch = html.match(/"captionTracks"\s*:\s*(\[[\s\S]*?\])/);
    if (!captionMatch) {
      console.log('No captionTracks found');
      return text(200, ''); // return empty string, UI will show fallback
    }

    let tracks;
    try {
      tracks = JSON.parse(captionMatch[1]);
    } catch (e) {
      console.error('Failed to parse captionTracks JSON:', e);
      return text(200, '');
    }

    if (!Array.isArray(tracks) || tracks.length === 0) {
      console.log('captionTracks array empty');
      return text(200, '');
    }

    // 3) Prefer English, then any auto-EN, then first available
    const en = tracks.find(t => t.languageCode === 'en' || t.languageCode?.startsWith('en'));
    const enAsr = tracks.find(t => (t.kind === 'asr') && (t.languageCode === 'en' || t.languageCode?.startsWith('en')));
    const track = en || enAsr || tracks[0];

    if (!track?.baseUrl) {
      console.log('No usable caption track baseUrl');
      return text(200, '');
    }

    // Some baseUrls need fmt to ensure <text> nodes; append if missing
    const baseUrl = track.baseUrl.includes('fmt=')
      ? track.baseUrl
      : `${track.baseUrl}&fmt=srv3`;

    // 4) Fetch the caption XML
    const subtitleXml = await fetchUrl(baseUrl);

    // 5) Parse and slice to the time window
    const clipSubtitles = parseSubtitles(subtitleXml, start, end);

    console.log(`Found ${clipSubtitles.length} subtitle segments in range`);
    return text(200, clipSubtitles.join(' '));
  } catch (err) {
    console.error('Transcript fetch failed:', err);
    return json(500, { error: 'Failed to fetch transcript', details: err.message });
  }
};

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          // Pretend to be a real browser to avoid some YT edge-cases
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode === 200) resolve(data);
          else reject(new Error(`HTTP ${res.statusCode}`));
        });
      }
    );

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// Parse <text start=".." dur=".."> ... </text> items and keep those overlapping [startTime, endTime]
function parseSubtitles(xml, startTime, endTime) {
  const out = [];
  const re = /<text[^>]*start="([^"]+)"[^>]*(?:dur="([^"]*)")?[^>]*>([\s\S]*?)<\/text>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const textStart = parseFloat(m[1]);
    const dur = m[2] ? parseFloat(m[2]) : 4;
    const textEnd = textStart + dur;
    if (
      (textStart >= startTime && textStart <= endTime) ||
      (textEnd >= startTime && textEnd <= endTime) ||
      (textStart <= startTime && textEnd >= endTime)
    ) {
      // Remove any inline tags and decode entities
      const raw = m[3].replace(/<[^>]*>/g, '').trim();
      const clean = decodeEntities(raw);
      if (clean) out.push(clean);
    }
  }
  return out;
}

function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
    body: JSON.stringify(obj),
  };
}

function text(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
    body,
  };
}

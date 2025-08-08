const https = require('https');
const MAX_REDIRECTS = 3;
const VERSION = 'subs-fn v4';

exports.handler = async (event) => {
  const { videoId, startTime, endTime, debug } = event.queryStringParameters || {};
  const isDebug = debug === '1';

  if (event.httpMethod === 'OPTIONS') {
    return resp(200, '', 'text/plain', { 'X-Subs-Version': VERSION });
  }
  if (!videoId || !startTime || !endTime) {
    return resp(400, JSON.stringify({ error: 'Missing required parameters: videoId, startTime, endTime' }), 'application/json', { 'X-Subs-Version': VERSION });
  }

  const start = parseFloat(startTime);
  const end = parseFloat(endTime);

  try {
    // 1) Try timedtext first (no scraping)
    const timedtextUrls = [
      `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=srv3`,
      `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&kind=asr&fmt=srv3`,
      `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en-GB&fmt=srv3`,
      `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en-US&fmt=srv3`,
    ];
    for (const u of timedtextUrls) {
      const xml = await fetchUrl(u).catch(() => null);
      if (xml && /<text[^>]*start=/.test(xml)) {
        const segs = parseSubtitles(xml, start, end);
        if (isDebug) {
          return resp(200, JSON.stringify({ source: 'timedtext', url: u, segments: segs.length, sample: segs.slice(0, 3) }, null, 2), 'application/json', { 'X-Subs-Version': VERSION });
        }
        return resp(200, segs.join(' '), 'text/plain', { 'X-Subs-Version': VERSION });
      }
    }

    // 2) Fallback: scrape watch HTML -> captionTracks or ytInitialPlayerResponse
    const html = await fetchUrl(`https://www.youtube.com/watch?v=${videoId}`);
    let tracks = null;

    let m = html.match(/"captionTracks"\s*:\s*(\[[\s\S]*?\])/);
    if (m) {
      try { tracks = JSON.parse(m[1]); } catch {}
    }
    if (!Array.isArray(tracks) || tracks.length === 0) {
      const pr = html.match(/ytInitialPlayerResponse"\s*:\s*(\{[\s\S]*?\})/);
      if (pr) {
        try {
          const obj = JSON.parse(pr[1]);
          tracks = obj?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
        } catch {}
      }
    }

    if (!Array.isArray(tracks) || tracks.length === 0) {
      if (isDebug) return resp(200, JSON.stringify({ source: 'scrape', reason: 'no_caption_tracks' }, null, 2), 'application/json', { 'X-Subs-Version': VERSION });
      return resp(200, '', 'text/plain', { 'X-Subs-Version': VERSION });
    }

    const en = tracks.find(t => t.languageCode?.startsWith('en'));
    const enAsr = tracks.find(t => t.kind === 'asr' && t.languageCode?.startsWith('en'));
    const track = en || enAsr || tracks[0];

    if (!track?.baseUrl) {
      if (isDebug) return resp(200, JSON.stringify({ source: 'scrape', reason: 'no_base_url', languages: tracks.map(t => ({ lang: t.languageCode, kind: t.kind })) }, null, 2), 'application/json', { 'X-Subs-Version': VERSION });
      return resp(200, '', 'text/plain', { 'X-Subs-Version': VERSION });
    }

    let baseUrl = track.baseUrl;
    if (!/[\?&]fmt=/.test(baseUrl)) baseUrl += (baseUrl.includes('?') ? '&' : '?') + 'fmt=srv3';

    const subtitleXml = await fetchUrl(baseUrl);
    const segs = parseSubtitles(subtitleXml, start, end);

    if (isDebug) {
      return resp(200, JSON.stringify({ source: 'scrape', usedTrack: { lang: track.languageCode, kind: track.kind }, segments: segs.length, sample: segs.slice(0, 3) }, null, 2), 'application/json', { 'X-Subs-Version': VERSION });
    }
    return resp(200, segs.join(' '), 'text/plain', { 'X-Subs-Version': VERSION });
  } catch (err) {
    return resp(500, JSON.stringify({ error: 'Failed to fetch transcript', details: err.message }), 'application/json', { 'X-Subs-Version': VERSION });
  }
};

function fetchUrl(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    }, (res) => {
      const { statusCode, headers } = res;
      if (statusCode >= 300 && statusCode < 400 && headers.location) {
        if (redirects >= MAX_REDIRECTS) return reject(new Error('Too many redirects'));
        const next = headers.location.startsWith('http') ? headers.location : new URL(headers.location, url).href;
        res.resume();
        fetchUrl(next, redirects + 1).then(resolve).catch(reject);
        return;
      }
      if (statusCode !== 200) return reject(new Error(`HTTP ${statusCode}`));
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

function parseSubtitles(xml, startTime, endTime) {
  const out = [];
  const re = /<text[^>]*start="([^"]+)"[^>]*(?:dur="([^"]*)")?[^>]*>([\s\S]*?)<\/text>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const s = parseFloat(m[1]);
    const dur = m[2] ? parseFloat(m[2]) : 4;
    const e = s + dur;
    if ((s >= startTime && s <= endTime) || (e >= startTime && e <= endTime) || (s <= startTime && e >= endTime)) {
      const raw = m[3].replace(/<[^>]*>/g, '').trim();
      const clean = raw
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      if (clean) out.push(clean);
    }
  }
  return out;
}

function resp(status, body, type, extra = {}) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': type,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',   // disable cache while testing
      ...extra,
    },
    body,
  };
}

const https = require('https');
const VERSION = 'subs-fn v5';

exports.handler = async (event) => {
  const { videoId, startTime, endTime, debug } = event.queryStringParameters || {};
  const isDebug = debug === '1';

  if (event.httpMethod === 'OPTIONS') {
    return resp(200, '', 'text/plain');
  }
  if (!videoId || !startTime || !endTime) {
    return resp(400, JSON.stringify({ error: 'Missing required parameters: videoId, startTime, endTime' }), 'application/json');
  }

  const start = Number(startTime);
  const end = Number(endTime);

  try {
    // ---------- 1) Enumerate tracks via timedtext list ----------
    const listXml = await safeFetch(`https://www.youtube.com/api/timedtext?type=list&v=${encodeURIComponent(videoId)}`);
    const tracks = parseTrackList(listXml); // [{lang, name, kind}] possibly empty

    if (isDebug && tracks.length === 0) {
      // If list is empty we’ll also try scraping below, but show we saw nothing here.
      // (Many vids still list tracks here; if empty, it’s often a consent/locale quirk.)
    }

    // Prefer EN > EN asr > anything
    const pick =
      tracks.find(t => t.lang?.toLowerCase().startsWith('en') && t.kind !== 'asr') ||
      tracks.find(t => t.lang?.toLowerCase().startsWith('en') && t.kind === 'asr') ||
      tracks[0];

    if (pick) {
      const timedtextUrl = buildTimedtextUrl(videoId, pick);
      const xml = await safeFetch(timedtextUrl);
      const segs = parseSubtitles(xml, start, end);
      if (isDebug) {
        return resp(200, JSON.stringify({ source: 'timedtext', picked: pick, segments: segs.length, sample: segs.slice(0, 3), tracks }, null, 2), 'application/json');
      }
      return resp(200, segs.join(' '), 'text/plain');
    }

    // ---------- 2) Fallback: scrape captionTracks from watch HTML ----------
    const html = await safeFetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`);
    let foundTracks = null;

    // Try captionTracks directly (DOTALL)
    const m1 = html.match(/"captionTracks"\s*:\s*(\[[\s\S]*?])/);
    if (m1) {
      try { foundTracks = JSON.parse(m1[1]); } catch {}
    }
    // Fallback: ytInitialPlayerResponse
    if (!Array.isArray(foundTracks) || foundTracks.length === 0) {
      const m2 = html.match(/ytInitialPlayerResponse"\s*:\s*(\{[\s\S]*?})\s*,\s*"(?:ytInitial|PLAYER_)/);
      if (m2) {
        try {
          const obj = JSON.parse(m2[1]);
          foundTracks = obj?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
        } catch {}
      }
    }

    if (!Array.isArray(foundTracks) || foundTracks.length === 0) {
      if (isDebug) {
        const consent = /consent|CONSENT|fcconsent|cookie/i.test(html) ? 'possible_consent_interstitial' : 'none_detected';
        return resp(200, JSON.stringify({ source: 'scrape', reason: 'no_caption_tracks', tracks_list_count: tracks.length, consent_hint: consent }, null, 2), 'application/json');
      }
      return resp(200, '', 'text/plain');
    }

    // Choose a track and fetch xml
    const en = foundTracks.find(t => t.languageCode?.toLowerCase().startsWith('en') && t.kind !== 'asr');
    const enAsr = foundTracks.find(t => t.languageCode?.toLowerCase().startsWith('en') && t.kind === 'asr');
    const track = en || enAsr || foundTracks[0];
    let baseUrl = track?.baseUrl || '';
    if (!baseUrl) {
      if (isDebug) return resp(200, JSON.stringify({ source: 'scrape', reason: 'no_base_url', languages: foundTracks.map(t => ({ lang: t.languageCode, kind: t.kind })) }, null, 2), 'application/json');
      return resp(200, '', 'text/plain');
    }
    if (!/[\?&]fmt=/.test(baseUrl)) {
      baseUrl += (baseUrl.includes('?') ? '&' : '?') + 'fmt=srv3';
    }

    const subXml = await safeFetch(baseUrl);
    const segs2 = parseSubtitles(subXml, start, end);
    if (isDebug) {
      return resp(200, JSON.stringify({ source: 'scrape', usedTrack: { lang: track.languageCode, kind: track.kind }, segments: segs2.length, sample: segs2.slice(0, 3), tracks_list_count: tracks.length }, null, 2), 'application/json');
    }
    return resp(200, segs2.join(' '), 'text/plain');
  } catch (err) {
    return resp(500, JSON.stringify({ error: 'Failed to fetch transcript', details: err.message }), 'application/json');
  }
};

// ---------- helpers ----------

// Use a single place to set headers, cookies, redirects
function fetchUrl(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        // Bypass YT consent interstitials:
        'Cookie': 'CONSENT=YES+cb.20210328-17-p0.en+FX',
      }
    }, (res) => {
      const { statusCode, headers } = res;

      // follow redirects
      if (statusCode >= 300 && statusCode < 400 && headers.location) {
        if (redirects >= 3) return reject(new Error('Too many redirects'));
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

async function safeFetch(url) {
  // add hl= & persist_hl= which sometimes helps caption exposure
  const u = new URL(url);
  if (!u.searchParams.has('hl')) u.searchParams.set('hl', 'en');
  if (!u.searchParams.has('persist_hl')) u.searchParams.set('persist_hl', '1');
  return fetchUrl(u.href);
}

function parseTrackList(xml) {
  // Example entries: <track id="0" lang_code="en" lang_translated="English" name="English" kind="asr"/>
  const tracks = [];
  const re = /<track\b([^>]+?)\/>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const attrs = m[1];
    const get = (k) => {
      const mm = attrs.match(new RegExp(`${k}="([^"]*)"`, 'i'));
      return mm ? mm[1] : '';
    };
    const lang = get('lang_code');
    const name = get('name'); // may be empty
    const kind = get('kind'); // 'asr' for auto
    if (lang) tracks.push({ lang, name, kind: kind || '' });
  }
  return tracks;
}

function buildTimedtextUrl(videoId, track) {
  const base = new URL('https://www.youtube.com/api/timedtext');
  base.searchParams.set('v', videoId);
  base.searchParams.set('fmt', 'srv3');
  base.searchParams.set('lang', track.lang);
  if (track.kind === 'asr') base.searchParams.set('kind', 'asr');
  if (track.name) base.searchParams.set('name', track.name);
  return base.href;
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

function resp(status, body, type) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': type,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
      'X-Subs-Version': VERSION,
    },
    body,
  };
}

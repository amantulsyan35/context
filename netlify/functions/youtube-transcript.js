const https = require('https');
const zlib = require('zlib');

const VERSION = 'subs-fn v8';

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
    // ---------- 0) timedtext (direct guesses) ----------
    const timedCandidates = [
      `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(videoId)}&lang=en&fmt=srv3`,
      `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(videoId)}&lang=en&kind=asr&fmt=srv3`,
      `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(videoId)}&lang=en-US&fmt=srv3`,
      `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(videoId)}&lang=en-GB&fmt=srv3`,
    ];
    for (const u of timedCandidates) {
      const xml = await safeFetch(u).catch(() => null);
      if (xml && /<text[^>]*start=/.test(xml)) {
        const segs = parseSubtitles(xml, start, end);
        if (isDebug) return dbg({ source: 'timedtext-direct', url: u, segments: segs.length, sample: segs.slice(0,3) });
        return resp(200, segs.join(' '), 'text/plain');
      }
    }

    // ---------- 1) timedtext list (enumerate exact tracks) ----------
    const listXml = await safeFetch(`https://www.youtube.com/api/timedtext?type=list&v=${encodeURIComponent(videoId)}`);
    const listTracks = parseTrackList(listXml); // [{lang, name, kind}]
    const pickedList =
      listTracks.find(t => t.lang?.toLowerCase().startsWith('en') && t.kind !== 'asr') ||
      listTracks.find(t => t.lang?.toLowerCase().startsWith('en') && t.kind === 'asr') ||
      listTracks[0];
    if (pickedList) {
      const url = buildTimedtextUrl(videoId, pickedList);
      const xml = await safeFetch(url);
      if (xml && /<text[^>]*start=/.test(xml)) {
        const segs = parseSubtitles(xml, start, end);
        if (isDebug) return dbg({ source: 'timedtext-list', picked: pickedList, segments: segs.length, sample: segs.slice(0,3), tracks: listTracks });
        return resp(200, segs.join(' '), 'text/plain');
      }
    }

    // ---------- 2) youtubei (WEB → TV → ANDROID) ----------
    // Get API key, client version, visitorData from the watch HTML
    const watchHtml = await safeFetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=en&bpctr=9999999999`);
    const apiKey = pickOne(watchHtml, [
      /"INNERTUBE_API_KEY":"([^"]+)"/,
      /"innertubeApiKey":"([^"]+)"/,
    ]);
    const webClientVersion = pickOne(watchHtml, [
      /"INNERTUBE_CLIENT_VERSION":"([^"]+)"/,
      /"clientVersion":"([^"]+)"/,
    ]);
    const visitorData = pickOne(watchHtml, [
      /"VISITOR_DATA":"([^"]+)"/,
      /"visitorData":"([^"]+)"/,
    ]);

    // Try WEB client if we have essentials
    if (apiKey && webClientVersion) {
      const webCtx = {
        client: {
          hl: 'en',
          gl: 'US',
          clientName: 'WEB',
          clientVersion: webClientVersion,
          visitorData: visitorData || undefined,
          originalUrl: `https://www.youtube.com/watch?v=${videoId}`,
        },
      };
      const player = await youtubeiPlayer(videoId, apiKey, webCtx, {
        'X-YouTube-Client-Name': '1',
        'X-YouTube-Client-Version': webClientVersion,
        ...(visitorData ? { 'X-Goog-Visitor-Id': visitorData } : {}),
      });

      const result = await captionsFromPlayer(player, start, end);
      if (result) {
        if (isDebug) return dbg({ source: 'youtubei-web', ...result.meta });
        return resp(200, result.text, 'text/plain');
      }

      // If explicitly LOGIN_REQUIRED, try next clients
      const playErr = player?.playabilityStatus?.status;
      if (isDebug && playErr) {
        // fall through to TV/Android
      }
    }

    // Try TV HTML5 embedded client (often bypasses some checks)
    if (apiKey) {
      const tvCtx = {
        client: {
          hl: 'en',
          gl: 'US',
          clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
          clientVersion: '2.0',
          visitorData: visitorData || undefined,
          originalUrl: `https://www.youtube.com/watch?v=${videoId}`,
        },
      };
      const playerTV = await youtubeiPlayer(videoId, apiKey, tvCtx, {
        'X-YouTube-Client-Name': '85', // TV client id
        'X-YouTube-Client-Version': '2.0',
        ...(visitorData ? { 'X-Goog-Visitor-Id': visitorData } : {}),
      });

      const resultTV = await captionsFromPlayer(playerTV, start, end);
      if (resultTV) {
        if (isDebug) return dbg({ source: 'youtubei-tv', ...resultTV.meta });
        return resp(200, resultTV.text, 'text/plain');
      }
    }

    // Try ANDROID client
    if (apiKey) {
      const androidVersion = '19.33.35';
      const androidCtx = {
        client: {
          hl: 'en',
          gl: 'US',
          clientName: 'ANDROID',
          clientVersion: androidVersion,
          androidSdkVersion: 30,
          userAgent: `com.google.android.youtube/${androidVersion} (Linux; U; Android 11) gzip`,
          visitorData: visitorData || undefined,
        },
      };
      const playerAndroid = await youtubeiPlayer(videoId, apiKey, androidCtx, {
        'X-YouTube-Client-Name': '3',
        'X-YouTube-Client-Version': androidVersion,
        'User-Agent': `com.google.android.youtube/${androidVersion} (Linux; U; Android 11) gzip`,
        ...(visitorData ? { 'X-Goog-Visitor-Id': visitorData } : {}),
      });

      const resultAndroid = await captionsFromPlayer(playerAndroid, start, end);
      if (resultAndroid) {
        if (isDebug) return dbg({ source: 'youtubei-android', ...resultAndroid.meta });
        return resp(200, resultAndroid.text, 'text/plain');
      }
    }

    // ---------- 3) Last resort: scrape captionTracks from HTML ----------
    let foundTracks = null;
    const m1 = watchHtml.match(/"captionTracks"\s*:\s*(\[[\s\S]*?])/);
    if (m1) { try { foundTracks = JSON.parse(m1[1]); } catch {} }
    if (!Array.isArray(foundTracks) || foundTracks.length === 0) {
      const m2 = watchHtml.match(/ytInitialPlayerResponse"\s*:\s*(\{[\s\S]*?})\s*,\s*"(?:ytInitial|PLAYER_)/);
      if (m2) {
        try {
          const obj = JSON.parse(m2[1]);
          foundTracks = obj?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
        } catch {}
      }
    }
    if (Array.isArray(foundTracks) && foundTracks.length) {
      const en = foundTracks.find(t => t.languageCode?.toLowerCase().startsWith('en') && t.kind !== 'asr');
      const enAsr = foundTracks.find(t => t.languageCode?.toLowerCase().startsWith('en') && t.kind === 'asr');
      const track = en || enAsr || foundTracks[0];
      let baseUrl = track?.baseUrl || '';
      if (baseUrl) {
        if (!/[\?&]fmt=/.test(baseUrl)) baseUrl += (baseUrl.includes('?') ? '&' : '?') + 'fmt=srv3';
        const xml = await safeFetch(baseUrl);
        const segs = parseSubtitles(xml, start, end);
        if (isDebug) return dbg({ source: 'scrape', usedTrack: { lang: track.languageCode, kind: track.kind }, segments: segs.length, sample: segs.slice(0,3) });
        return resp(200, segs.join(' '), 'text/plain');
      }
    }

    // Nothing worked
    if (isDebug) return dbg({ source: 'none', reason: 'no_tracks_found_anywhere' });
    return resp(200, '', 'text/plain');
  } catch (err) {
    return resp(500, JSON.stringify({ error: 'Failed to fetch transcript', details: err.message }), 'application/json');
  }
};

// --------------- helpers -----------------

function pickOne(s, regexes) { for (const r of regexes) { const m = s.match(r); if (m) return m[1]; } return null; }

async function youtubeiPlayer(videoId, apiKey, contextObj, extraHeaders = {}) {
  const url = `https://www.youtube.com/youtubei/v1/player?key=${encodeURIComponent(apiKey)}`;
  const bodyObj = {
    context: contextObj,
    videoId,
    contentCheckOk: true,
    racyCheckOk: true,
  };
  const body = JSON.stringify(bodyObj);
  const json = await fetchUrl(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'https://www.youtube.com',
      'Referer': 'https://www.youtube.com/',
      'Accept-Encoding': 'gzip, br, deflate',
      ...extraHeaders,
    },
    body,
  });
  try { return JSON.parse(json); } catch { return null; }
}

async function captionsFromPlayer(playerJson, start, end) {
  const tracks = playerJson?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  if (!Array.isArray(tracks) || tracks.length === 0) return null;
  const en = tracks.find(t => t.languageCode?.toLowerCase().startsWith('en') && t.kind !== 'asr');
  const enAsr = tracks.find(t => t.languageCode?.toLowerCase().startsWith('en') && t.kind === 'asr');
  const track = en || enAsr || tracks[0];

  let baseUrl = track?.baseUrl || '';
  if (!baseUrl) return null;
  if (!/[\?&]fmt=/.test(baseUrl)) baseUrl += (baseUrl.includes('?') ? '&' : '?') + 'fmt=srv3';

  const xml = await safeFetch(baseUrl);
  const segs = parseSubtitles(xml, start, end);
  return {
    text: segs.join(' '),
    meta: { usedTrack: { lang: track.languageCode, kind: track.kind }, segments: segs.length, sample: segs.slice(0,3) }
  };
}

function fetchUrl(url, { method = 'GET', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      method,
      hostname: u.hostname,
      path: u.pathname + (u.search || ''),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, br, deflate',
        // Cookies to dodge consent/bot checks as much as possible
        'Cookie': [
          'CONSENT=YES+cb.20240717-16-p0.en+FX',
          'SOCS=CAISNQgDEiI2Z3ZyX2VuX1VTL2VuOkdCOjIwMjUwODA4LjA=',
          'PREF=tz=Asia.Kolkata&f6=400',
        ].join('; '),
        ...headers,
      },
    };

    const req = https.request(opts, (res) => {
      const { statusCode, headers: h } = res;

      // Redirects
      if (statusCode >= 300 && statusCode < 400 && h.location) {
        const next = h.location.startsWith('http') ? h.location : new URL(h.location, url).href;
        res.resume();
        fetchUrl(next, { method: 'GET', headers }).then(resolve).catch(reject);
        return;
      }

      // Collect body (even on errors) so we can decode
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const enc = (h['content-encoding'] || '').toLowerCase();
        try {
          let out;
          if (enc.includes('br')) out = zlib.brotliDecompressSync(buf);
          else if (enc.includes('gzip')) out = zlib.gunzipSync(buf);
          else if (enc.includes('deflate')) out = zlib.inflateSync(buf);
          else out = buf;
          if (statusCode !== 200) reject(new Error(`HTTP ${statusCode}: ${out.toString('utf8').slice(0,200)}`));
          else resolve(out.toString('utf8'));
        } catch (e) {
          reject(new Error(`Decompression failed (${enc || 'none'}): ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Request timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

async function safeFetch(url) {
  const u = new URL(url);
  if (!u.searchParams.has('hl')) u.searchParams.set('hl', 'en');
  if (!u.searchParams.has('persist_hl')) u.searchParams.set('persist_hl', '1');
  return fetchUrl(u.href);
}

function parseTrackList(xml) {
  const tracks = [];
  if (!xml) return tracks;
  const re = /<track\b([^>]+?)\/>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const attrs = m[1];
    const get = (k) => {
      const mm = attrs.match(new RegExp(`${k}="([^"]*)"`, 'i'));
      return mm ? mm[1] : '';
    };
    const lang = get('lang_code');
    const name = get('name');
    const kind = get('kind');
    if (lang) tracks.push({ lang, name, kind: kind || '' });
  }
  return tracks;
}

function parseSubtitles(xml, startTime, endTime) {
  const out = [];
  if (!xml) return out;
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

function dbg(obj) { return resp(200, JSON.stringify(obj, null, 2), 'application/json'); }

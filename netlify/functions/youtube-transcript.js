const https = require('https');
const zlib = require('zlib');

const VERSION = 'subs-fn v7';

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
    // ---------- 1) Try timedtext directly (common combos) ----------
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

    // ---------- 2) Enumerate tracks via timedtext list ----------
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

    // ---------- 3) youtubei player API (robust) ----------
    // Fetch watch HTML (with consent cookies) to extract API key & client version
    const watchHtml = await safeFetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=en&bpctr=9999999999`);
    const apiKey = matchOne(watchHtml, /"INNERTUBE_API_KEY":"([^"]+)"/) || matchOne(watchHtml, /"innertubeApiKey":"([^"]+)"/);
    const clientVersion = matchOne(watchHtml, /"INNERTUBE_CLIENT_VERSION":"([^"]+)"/) || matchOne(watchHtml, /"clientVersion":"([^"]+)"/);
    if (apiKey && clientVersion) {
      const playerJson = await youtubeiPlayer(videoId, apiKey, clientVersion);
      const tracks = playerJson?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
      if (Array.isArray(tracks) && tracks.length) {
        const en = tracks.find(t => t.languageCode?.toLowerCase().startsWith('en') && t.kind !== 'asr');
        const enAsr = tracks.find(t => t.languageCode?.toLowerCase().startsWith('en') && t.kind === 'asr');
        const track = en || enAsr || tracks[0];
        let baseUrl = track?.baseUrl || '';
        if (baseUrl) {
          if (!/[\?&]fmt=/.test(baseUrl)) baseUrl += (baseUrl.includes('?') ? '&' : '?') + 'fmt=srv3';
          const xml = await safeFetch(baseUrl);
          const segs = parseSubtitles(xml, start, end);
          if (isDebug) return dbg({ source: 'youtubei', usedTrack: { lang: track.languageCode, kind: track.kind }, segments: segs.length, sample: segs.slice(0,3) });
          return resp(200, segs.join(' '), 'text/plain');
        }
      } else if (isDebug) {
        // Helpful to see what youtubei said
        return dbg({ source: 'youtubei', reason: 'no_caption_tracks', hasPlayer: !!playerJson, playerError: playerJson?.playabilityStatus });
      }
    } else if (isDebug) {
      return dbg({ source: 'youtubei', reason: 'missing_api_key_or_client_version' });
    }

    // ---------- 4) Last resort: scrape captionTracks from watch HTML ----------
    let foundTracks = null;
    const m1 = watchHtml.match(/"captionTracks"\s*:\s*(\[[\s\S]*?])/);
    if (m1) try { foundTracks = JSON.parse(m1[1]); } catch {}
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

    // ---------- No luck ----------
    if (isDebug) {
      return dbg({ source: 'none', reason: 'no_tracks_found_anywhere' });
    }
    return resp(200, '', 'text/plain');
  } catch (err) {
    return resp(500, JSON.stringify({ error: 'Failed to fetch transcript', details: err.message }), 'application/json');
  }
};

// ---------------- helpers ----------------

function matchOne(str, re) { const m = str.match(re); return m ? m[1] : null; }

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
        // Try to bypass consent:
        'Cookie': 'CONSENT=YES+cb.20240717-16-p0.en+FX; SOCS=CAISNQgDEiI2Z3ZyX2VuX1VTL2VuOkdCOjIwMjUwODA4LjA=:__', // generic consent-ish
        ...headers,
      },
    };

    const req = https.request(opts, (res) => {
      const { statusCode, headers: h } = res;

      // follow redirects
      if (statusCode >= 300 && statusCode < 400 && h.location) {
        const next = h.location.startsWith('http') ? h.location : new URL(h.location, url).href;
        res.resume();
        fetchUrl(next, { method: 'GET', headers }).then(resolve).catch(reject);
        return;
      }

      if (statusCode !== 200) {
        // Some youtubei errors still return JSON; collect body then reject
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          const enc = (h['content-encoding'] || '').toLowerCase();
          let raw = buf;
          try {
            if (enc.includes('br')) raw = zlib.brotliDecompressSync(buf);
            else if (enc.includes('gzip')) raw = zlib.gunzipSync(buf);
            else if (enc.includes('deflate')) raw = zlib.inflateSync(buf);
          } catch {}
          reject(new Error(`HTTP ${statusCode}: ${raw.toString('utf8').slice(0,200)}`));
        });
        return;
      }

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
          resolve(out.toString('utf8'));
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

async function youtubeiPlayer(videoId, apiKey, clientVersion) {
  const url = `https://www.youtube.com/youtubei/v1/player?key=${encodeURIComponent(apiKey)}`;
  const bodyObj = {
    context: {
      client: {
        hl: 'en',
        gl: 'US',
        clientName: 'WEB',
        clientVersion: clientVersion,
      },
    },
    videoId,
    contentCheckOk: true,
    racyCheckOk: true,
  };
  const body = JSON.stringify(bodyObj);
  const json = await fetchUrl(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-YouTube-Client-Name': '1',
      'X-YouTube-Client-Version': clientVersion,
      'Origin': 'https://www.youtube.com',
      'Referer': 'https://www.youtube.com/',
    },
    body,
  });
  try { return JSON.parse(json); } catch { return null; }
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

function dbg(obj) {
  return resp(200, JSON.stringify(obj, null, 2), 'application/json');
}

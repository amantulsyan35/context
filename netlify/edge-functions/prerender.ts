// netlify/edge-functions/prerender.ts
import type { Context, Config } from '@netlify/edge-functions';

const PRERENDER_TOKEN = 'wCbfdB9sQfa9bgx8lD80';
const BOT_REGEX =
  /bot|crawler|spider|bingbot|duckduckbot|baiduspider|yandex|facebookexternalhit|slackbot|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot/i;
const PRERENDER_UA_REGEX = /prerender|headlesschrome|puppeteer/i;

const isAssetPath = (p: string) =>
  /\.(?:js|css|png|jpe?g|gif|webp|svg|ico|json|txt|xml|map|woff2?|ttf|eot|mp4|webm|ogg)$/i.test(p);

const htmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

const ytId = (url: string) => {
  try {
    const short = url.match(/^https?:\/\/youtu\.be\/([A-Za-z0-9_-]{11})/i);
    if (short) return short[1];
    const embed = url.match(/youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{11})/i);
    if (embed) return embed[1];
    const u = new URL(url);
    const v = u.searchParams.get('v');
    if ((u.hostname.includes('youtube.com') || u.hostname.includes('youtube-nocookie.com')) && v) return v;
  } catch {}
  return null;
};

const renderOG = (opts: {
  title: string;
  canonical: string;
  image: string;
  description: string;
}) => {
  const { title, canonical, image, description } = opts;
  const t = htmlEscape(title);
  const d = htmlEscape(description);
  const i = htmlEscape(image);
  const c = htmlEscape(canonical);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${t}</title>
  <link rel="canonical" href="${c}" />
  <meta property="og:title" content="${t}" />
  <meta property="og:description" content="${d}" />
  <meta property="og:type" content="video.other" />
  <meta property="og:url" content="${c}" />
  <meta property="og:image" content="${i}" />
  <meta property="og:image:secure_url" content="${i}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${t}" />
  <meta name="twitter:description" content="${d}" />
  <meta name="twitter:image" content="${i}" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <script>location.replace(${JSON.stringify(c)});</script>
</body>
</html>`;
};

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const ua = request.headers.get('user-agent') || '';
  const accept = request.headers.get('accept') || '';

  // Only HTML GET/HEAD; skip assets & APIs
  if (!/^(GET|HEAD)$/i.test(request.method)) return context.next();
  if (!accept.includes('text/html')) return context.next();
  if (isAssetPath(url.pathname) || url.pathname.startsWith('/api')) return context.next();

  const isBot = BOT_REGEX.test(ua);
  if (!isBot) return context.next();
  if (PRERENDER_UA_REGEX.test(ua) || request.headers.has('X-Prerender')) return context.next();

  // Try SSR OG for /:videoId (single segment path)
  const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
  const looksLikeVideoId = parts.length === 1 && parts[0].length > 0;

  if (looksLikeVideoId) {
    const id = parts[0];
    // Fetch video JSON from our function (short timeout)
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 3000);

    try {
      const api = `${url.origin}/.netlify/functions/public-video?id=${encodeURIComponent(id)}`;
      const r = await fetch(api, { signal: ac.signal, headers: { 'accept': 'application/json' } });
      clearTimeout(t);

      if (r.ok) {
        const v = await r.json() as { title: string; link: string; startTime: number; endTime: number };
        const vid = ytId(v.link);
        const img = vid
          ? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`
          : `${url.origin}/context_og.jpg`;

        const html = renderOG({
          title: v.title,
          canonical: url.origin + url.pathname,
          image: img,
          description: `Watch "${v.title}" – Context sharing made simple.`,
        });

        return new Response(html, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'max-age=0, s-maxage=600',
            'Vary': 'User-Agent',
            'x-prerender-edge': 'ssr',
            'x-prerender-status': '200',
          },
        });
      }
    } catch {
      // fall through to Prerender
    } finally {
      clearTimeout(t);
    }
  }

  // Fallback: proxy to Prerender
  const target = `https://service.prerender.io/${url.protocol}//${url.host}${url.pathname}${url.search}`;
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 8000);

  let resp: Response | undefined;
  try {
    resp = await fetch(target, {
      headers: {
        'User-Agent': ua,
        'Host': url.host,
        'X-Forwarded-Proto': url.protocol.replace(':', ''),
        'X-Prerender-Token': PRERENDER_TOKEN,
        'Accept-Language': request.headers.get('accept-language') || '',
        'Referer': request.headers.get('referer') || '',
      },
      cache: 'no-store',
      signal: ac.signal,
    });
  } catch {}
  clearTimeout(timeout);

  if (resp?.ok) {
    const html = await resp.text();
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'max-age=0, s-maxage=600',
        'Vary': 'User-Agent',
        'x-prerender-edge': 'hit',
        'x-prerender-status': String(resp.status),
      },
    });
  }

  // Last resort
  const downstream = await context.next();
  const h = new Headers(downstream.headers);
  h.set('Vary', [h.get('Vary'), 'User-Agent'].filter(Boolean).join(', '));
  h.set('x-prerender-edge', 'miss');
  h.set('x-prerender-status', resp ? String(resp.status) : '599');
  return new Response(downstream.body, { status: downstream.status, headers: h });
};

export const config: Config = { path: '/*' };

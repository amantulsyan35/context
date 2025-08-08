// /netlify/edge-functions/prerender.ts
import type { Context, Config } from "@netlify/edge-functions";

/**
 * If you prefer env vars, swap this for: const PRERENDER_TOKEN = Deno.env.get('PRERENDER_TOKEN')!;
 */
const PRERENDER_TOKEN = "wCbfdB9sQfa9bgx8lD80";

const BOT_REGEX =
  /bot|crawler|spider|bingbot|duckduckbot|baiduspider|yandex|facebookexternalhit|slackbot|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot/i;

// Avoid infinite loops if Prerender (or a headless fetch) re-calls your site
const PRERENDER_UA_REGEX = /prerender|headlesschrome|puppeteer/i;

const isAssetPath = (p: string) =>
  /\.(?:js|css|png|jpe?g|gif|webp|svg|ico|json|txt|xml|map|woff2?|ttf|eot|mp4|webm|ogg)$/i.test(p);

const htmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

const ytId = (url: string) => {
  try {
    // youtu.be/<id> - exactly 11 characters
    const short = url.match(/^https?:\/\/youtu\.be\/([A-Za-z0-9_-]{11})(?:\?|$)/i);
    if (short) return short[1];
    
    // youtube(-nocookie).com/embed/<id> - exactly 11 characters
    const embed = url.match(/youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{11})(?:\?|$)/i);
    if (embed) return embed[1];
    
    // youtube(-nocookie).com/watch?v=<id>
    const u = new URL(url);
    if ((u.hostname.includes("youtube.com") || u.hostname.includes("youtube-nocookie.com"))) {
      const v = u.searchParams.get("v");
      // Validate YouTube ID is exactly 11 characters
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
    }
  } catch (e) {
    console.error("Error parsing YouTube URL:", e);
  }
  return null;
};

const getYouTubeThumbnail = (videoId: string | null): string => {
  if (!videoId) return "";
  
  // Use hqdefault as it's more reliable than maxresdefault
  // hqdefault (480x360) exists for virtually all videos
  // You could also try: mqdefault (320x180), sddefault (640x480)
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
};

const renderOG = (opts: {
  title: string;
  canonical: string;
  image: string;
  description: string;
}) => {
  const t = htmlEscape(opts.title);
  const d = htmlEscape(opts.description);
  const i = htmlEscape(opts.image);
  const c = htmlEscape(opts.canonical);

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
  <meta property="og:image:width" content="480" />
  <meta property="og:image:height" content="360" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${t}" />
  <meta name="twitter:description" content="${d}" />
  <meta name="twitter:image" content="${i}" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <!-- Simple client redirect so humans still land on the SPA -->
  <script>location.replace(${JSON.stringify(c)});</script>
</body>
</html>`;
};

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const ua = request.headers.get("user-agent") || "";

  // Only HTML-like GET/HEAD; skip assets & APIs
  if (!/^(GET|HEAD)$/i.test(request.method)) return context.next();
  if (isAssetPath(url.pathname) || url.pathname.startsWith("/api")) return context.next();

  const isBot = BOT_REGEX.test(ua);
  if (!isBot) return context.next();

  // Loop guard (when Prerender itself fetches your site)
  if (PRERENDER_UA_REGEX.test(ua) || request.headers.has("X-Prerender")) {
    return context.next();
  }

  // Heuristic: your app routes /:videoId at the root
  const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
  const looksLikeVideoId = parts.length === 1 && parts[0].length > 0;

  // Try to SSR OG for /:videoId via a small Netlify function that returns video JSON
  if (looksLikeVideoId) {
    const id = parts[0];
    const api = `${url.origin}/.netlify/functions/public-video?id=${encodeURIComponent(id)}`;

    console.log(`Processing video ID: ${id}`);
    console.log(`API URL: ${api}`);

    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 3000);

    try {
      const r = await fetch(api, {
        signal: ac.signal,
        headers: { 
          "accept": "application/json",
          "user-agent": "Netlify Edge Function"
        },
      });
      clearTimeout(timeout);

      console.log(`API Response Status: ${r.status}`);

      if (r.ok) {
        const v = await r.json() as {
          title: string;
          link: string;
          startTime?: number;
          endTime?: number;
        };

        console.log('Video data received:', {
          title: v.title,
          link: v.link,
          startTime: v.startTime,
          endTime: v.endTime
        });

        const vid = ytId(v.link);
        console.log(`Extracted YouTube ID: ${vid}`);

        // Get thumbnail with fallback
        let image = "";
        if (vid) {
          image = getYouTubeThumbnail(vid);
          console.log(`YouTube thumbnail URL: ${image}`);
        } else {
          image = `${url.origin}/context_og.jpg`;
          console.log(`Using fallback image: ${image}`);
        }

        const html = renderOG({
          title: v.title,
          canonical: url.origin + url.pathname, // no search to avoid dupes
          image,
          description: `Watch "${v.title}" – Context sharing made simple.`,
        });

        console.log('Generated OG HTML successfully');

        return new Response(html, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "max-age=0, s-maxage=600",
            "Vary": "User-Agent",
            "x-prerender-edge": "ssr",
            "x-prerender-status": "200",
            "x-video-id": vid || "none",
            "x-image-url": image,
          },
        });
      } else {
        console.log(`API returned non-OK status: ${r.status}`);
      }
      // If 404/500/etc, fall through to Prerender below
    } catch (error) {
      clearTimeout(timeout);
      console.error('Error fetching video data:', error);
      // Fall through to Prerender below on timeout/network error
    } finally {
      clearTimeout(timeout);
    }
  }

  // Fallback: proxy to Prerender.io (works for any path)
  const target = `https://service.prerender.io/${url.protocol}//${url.host}${url.pathname}${url.search}`;

  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 8000);

  let upstream: Response | undefined;
  try {
    upstream = await fetch(target, {
      headers: {
        "User-Agent": ua,
        "Host": url.host,
        "X-Forwarded-Proto": url.protocol.replace(":", ""),
        "X-Prerender-Token": PRERENDER_TOKEN,
        "Accept-Language": request.headers.get("accept-language") || "",
        "Referer": request.headers.get("referer") || "",
      },
      cache: "no-store",
      signal: ac.signal,
    });
  } catch (error) {
    console.error('Error fetching from Prerender.io:', error);
    // swallow, we'll mark miss below
  } finally {
    clearTimeout(timeout);
  }

  if (upstream?.ok) {
    const html = await upstream.text();
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "max-age=0, s-maxage=600",
        "Vary": "User-Agent",
        "x-prerender-edge": "hit",
        "x-prerender-status": String(upstream.status),
      },
    });
  }

  // Last resort: let the SPA handle it, but keep debug headers
  const downstream = await context.next();
  const h = new Headers(downstream.headers);
  h.set("Vary", [h.get("Vary"), "User-Agent"].filter(Boolean).join(", "));
  h.set("x-prerender-edge", "miss");
  h.set("x-prerender-status", upstream ? String(upstream.status) : "599");
  return new Response(downstream.body, { status: downstream.status, headers: h });
};

export const config: Config = { path: "/*" };
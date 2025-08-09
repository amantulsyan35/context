// /netlify/edge-functions/prerender.ts
import type { Context, Config } from "@netlify/edge-functions";

// Prerender fallback (only if SSR fails or path doesn't match)
const PRERENDER_TOKEN = "wCbfdB9sQfa9bgx8lD80";
// Your Cloudinary cloud
const CLOUDINARY_CLOUD = "dkrdwicst";

const BOT_REGEX =
  /bot|crawler|spider|bingbot|duckduckbot|baiduspider|yandex|facebookexternalhit|slackbot|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot/i;
// UA-only loop guard (don't use X-Prerender header — Netlify may set it)
const PRERENDER_UA_REGEX = /prerender|headlesschrome|puppeteer/i;

const isAssetPath = (p: string) =>
  /\.(?:js|css|png|jpe?g|gif|webp|svg|ico|json|txt|xml|map|woff2?|ttf|eot|mp4|webm|ogg)$/i.test(p);

const htmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

const ytId = (url: string) => {
  try {
    const short = url.match(/^https?:\/\/youtu\.be\/([A-Za-z0-9_-]{11})(?:\?|$)/i);
    if (short) return short[1];
    const embed = url.match(/youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{11})(?:\?|$)/i);
    if (embed) return embed[1];
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtube-nocookie.com")) {
      const v = u.searchParams.get("v");
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
    }
  } catch {}
  return null;
};

// Cloudinary-safe text encoder (no replaceAll)
const cldText = (t: string) =>
  encodeURIComponent(t).replace(/%2F/g, "%252F").replace(/%2C/g, "%252C");

// Build Cloudinary URL: fetch YT hqdefault + title overlay
const cloudinaryFromYt = (cloud: string, yt: string) =>
  `https://res.cloudinary.com/${cloud}/image/fetch/` +
  `w_1200,h_630,c_fill,q_auto,f_jpg/` +
  `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;

const renderOG = (opts: { title: string; canonical: string; image: string; description: string }) => {
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
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
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
  const ua = request.headers.get("user-agent") || "";

  // Helper: always add debug headers when passing downstream
  const pass = async (why: string) => {
    const downstream = await context.next();
    const h = new Headers(downstream.headers);
    h.set("x-edge-test", "on");
    h.set("x-ssr", `pass:${why}`);
    h.set("Vary", [h.get("Vary"), "User-Agent"].filter(Boolean).join(", "));
    return new Response(downstream.body, { status: downstream.status, headers: h });
  };

  // Skip non-HTML and assets/APIs/functions
  if (!/^(GET|HEAD)$/i.test(request.method)) return pass("method");
  if (isAssetPath(url.pathname)) return pass("asset");
  if (url.pathname.startsWith("/api")) return pass("api");
  if (url.pathname.startsWith("/.netlify/functions/")) return pass("fn");

  // Only handle bots; UA-only loop guard
  if (!BOT_REGEX.test(ua)) return pass("not-bot");
  if (PRERENDER_UA_REGEX.test(ua)) return pass("loop-guard-ua");

  // Match /:videoId (single segment)
  const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
  const looksLikeVideoId = parts.length === 1 && parts[0].length > 0;
  if (!looksLikeVideoId) return pass("no-id");

  const pageId = parts[0];
  const api = `${url.origin}/.netlify/functions/public-video?id=${encodeURIComponent(pageId)}`;

  // Fetch page meta from your function (short timeout)
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 3500);

  let funcStatus = 0;
  try {
    const r = await fetch(api, { signal: ac.signal, headers: { accept: "application/json" } });
    clearTimeout(timeout);
    funcStatus = r.status;

    if (r.ok) {
      const v = (await r.json()) as { title: string; link: string; startTime?: number; endTime?: number };
      const ytid = ytId(v.link);
      const image = ytid ? cloudinaryFromYt(CLOUDINARY_CLOUD, ytid) : `${url.origin}/context_og.jpg`;


      const html = renderOG({
        title: v.title,
        canonical: url.origin + url.pathname,
        image,
        description: `Watch "${v.title}" – Context sharing made simple.`,
      });

      const h = new Headers({
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "max-age=0, s-maxage=600",
        "Vary": "User-Agent",
        "x-prerender-edge": "ssr",
        "x-image-url": image,
        "x-video-id": ytid ?? "none",
        "x-edge-test": "on",
        "x-ssr": "func200",
      });
      return new Response(html, { status: 200, headers: h });
    }
  } catch {
    clearTimeout(timeout);
  }

  // Fallback to Prerender.io
  const target = `https://service.prerender.io/${url.protocol}//${url.host}${url.pathname}${url.search}`;
  const ac2 = new AbortController();
  const timeout2 = setTimeout(() => ac2.abort(), 8000);

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
      signal: ac2.signal,
    });
  } catch {
    // swallow
  } finally {
    clearTimeout(timeout2);
  }

  if (upstream?.ok) {
    const html = await upstream.text();
    const h = new Headers({
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "max-age=0, s-maxage=600",
      "Vary": "User-Agent",
      "x-prerender-edge": "hit",
      "x-prerender-status": String(upstream.status),
      "x-edge-test": "on",
      "x-ssr": `prerender:${funcStatus || "no-func"}`,
    });
    return new Response(html, { status: 200, headers: h });
  }

  // Last resort: SPA
  return pass(`spa:${funcStatus || "no-func"}`);
};

export const config: Config = { path: "/*" };

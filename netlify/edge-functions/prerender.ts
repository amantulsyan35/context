// /netlify/edge-functions/prerender.ts
import type { Context, Config } from "@netlify/edge-functions";

// HARD-CODED for your quick test (swap to env later)
const PRERENDER_TOKEN = "wCbfdB9sQfa9bgx8lD80";

const BOT_REGEX =
  /bot|crawler|spider|bingbot|duckduckbot|baiduspider|yandex|facebookexternalhit|slackbot|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot/i;

const isAssetPath = (p: string) =>
  /\.(?:js|css|png|jpe?g|gif|webp|svg|ico|json|txt|xml|map|woff2?|ttf|eot|mp4|webm|ogg)$/i.test(p);

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const ua = request.headers.get("user-agent") || "";

  // Only GET/HEAD matter; skip assets & APIs
  if (!/^(GET|HEAD)$/i.test(request.method)) return await context.next();
  if (isAssetPath(url.pathname) || url.pathname.startsWith("/api")) return await context.next();

  // Bot check
  const isBot = BOT_REGEX.test(ua);
  if (!isBot) return await context.next();

  // Prerender wants the full absolute URL after their host
  const target = `https://service.prerender.io/${url.protocol}//${url.host}${url.pathname}${url.search}`;

  try {
    const resp = await fetch(target, {
      headers: {
        "User-Agent": ua,
        "Host": url.host,
        "X-Forwarded-Proto": url.protocol.replace(":", ""),
        "X-Prerender-Token": PRERENDER_TOKEN,
        "Accept-Language": request.headers.get("accept-language") || "",
        "Referer": request.headers.get("referer") || "",
      },
      cache: "no-store", // avoid stale during debug
    });

    if (!resp.ok) return await context.next();

    const html = await resp.text();

    // Important: CDN cache only, vary by UA so user cache doesn't mix with bot cache
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "max-age=0, s-maxage=600", // CDN 10m, browsers 0
        "Vary": "User-Agent",
        "x-prerender-edge": "hit",
        "x-prerender-status": "200",
      },
    });
  } catch {
    // Fail open: let your SPA handle it
    return await context.next();
  }
};

// Map to all paths (or configure in netlify.toml)
export const config: Config = { path: "/*" };

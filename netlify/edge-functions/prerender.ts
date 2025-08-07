// /netlify/edge-functions/prerender.ts
import type { Context, Config } from "@netlify/edge-functions";

const BOT_REGEX = /bot|crawler|spider|bingbot|duckduckbot|baiduspider|yandex|facebookexternalhit|slackbot|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot/i;
const TOKEN = "wCbfdB9sQfa9bgx8lD80";

const isAssetPath = (p: string) =>
  /\.(?:js|css|png|jpe?g|gif|webp|svg|ico|json|txt|xml|map|woff2?|ttf|eot|mp4|webm|ogg)$/i.test(p);

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const ua = (request.headers.get("user-agent") || "").toLowerCase();

  // Don’t prerender static files
  if (isAssetPath(url.pathname)) return await context.next();

  const isBot = BOT_REGEX.test(ua);
  if (!isBot) return await context.next();

  const target = `https://service.prerender.io/${url.protocol}//${url.host}${url.pathname}${url.search}`;

  try {
    const resp = await fetch(target, {
      headers: {
        "User-Agent": ua,
        "Host": url.host,
        "X-Forwarded-Proto": url.protocol.replace(":", ""),
        "X-Prerender-Token": TOKEN,
        "Accept-Language": request.headers.get("accept-language") || "",
        "Referer": request.headers.get("referer") || "",
      },
      cache: "no-store",
    });

    if (!resp.ok) {
      return new Response(null, {
        status: 204,
        headers: { "x-prerender-edge": "miss", "x-prerender-status": String(resp.status) },
      });
    }

    const html = await resp.text();
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=600",
        "x-prerender-edge": "hit",
        "x-prerender-status": "200",
      },
    });
  } catch (e) {
    return new Response(null, {
      status: 204,
      headers: { "x-prerender-edge": "error" },
    });
  }
};

export const config: Config = { path: "/*" };

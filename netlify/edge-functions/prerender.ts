// /netlify/edge-functions/prerender.ts
import type { Context, Config } from "@netlify/edge-functions";

const BOT_REGEX =
  /bot|crawler|spider|facebookexternalhit|slackbot|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot/i;

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const ua = request.headers.get("user-agent") || "";
  const isBot = BOT_REGEX.test(ua);

  if (!isBot) {
    return await context.next();
  }

  // Prerender expects the full absolute URL after their host
  const target = `https://service.prerender.io/${url.protocol}//${url.host}${url.pathname}${url.search}`;

  try {
    const resp = await fetch(target, {
      headers: {
        "User-Agent": ua,
        "Host": url.host,
        "X-Forwarded-Proto": url.protocol.replace(":", ""),
        "X-Prerender-Token": "wCbfdB9sQfa9bgx8lD80", // hardcoded token
      },
    });

    if (!resp.ok) {
      console.error(`Prerender.io error: ${resp.status}`);
      return await context.next();
    }

    const html = await resp.text();
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=600",
      },
    });
  } catch (e) {
    console.error("Prerender Edge error", e);
    return await context.next();
  }
};

export const config: Config = { path: "/*" };

import type { Context } from "https://edge.netlify.com";

const SOCIAL_CRAWLERS = [
  "facebookexternalhit",
  "twitterbot",
  "linkedinbot",
  "whatsapp",
  "telegrambot",
  "slackbot",
  "discordbot",
  "googlebot"
];

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const userAgent = request.headers.get("user-agent")?.toLowerCase() || "";
  
  // Check if this is a social media crawler
  const isSocialCrawler = SOCIAL_CRAWLERS.some(crawler => 
    userAgent.includes(crawler.toLowerCase())
  );
  
  // If not a social crawler, serve normally
  if (!isSocialCrawler) {
    return context.next();
  }

  console.log(`Social crawler detected: ${userAgent}`);
  
  try {
    // Use Prerender.io service
    const prerenderUrl = `https://service.prerender.io/wCbfdB9sQfa9bgx8lD80/${url.href}`;
    
    const response = await fetch(prerenderUrl, {
      headers: {
        'User-Agent': userAgent,
        'X-Prerender-Token': 'wCbfdB9sQfa9bgx8lD80'
      }
    });
    
    if (response.ok) {
      const html = await response.text();
      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    } else {
      console.error(`Prerender.io failed with status: ${response.status}`);
      return context.next();
    }
    
  } catch (error) {
    console.error("Error in prerender edge function:", error);
    return context.next();
  }
};
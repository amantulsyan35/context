// netlify/functions/public-video.ts
import type { Handler } from '@netlify/functions';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api'; // adjust path if needed

const CONVEX_URL = "https://ardent-blackbird-771.convex.cloud";

export const handler: Handler = async (event) => {
  try {
    const id = event.queryStringParameters?.id as string | undefined;
    if (!id) return { statusCode: 400, body: 'Missing id' };
    if (!CONVEX_URL) return { statusCode: 500, body: 'Missing CONVEX_URL' };

    const client = new ConvexHttpClient(CONVEX_URL);

    // Your existing query: expects Id<'videos'> = page/document id
    const video = await client.query(api.videos.getVideoById, { id: id as any });

    if (!video) return { statusCode: 404, body: 'Not found' };

    // Return the minimal shape the edge needs
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' },
      body: JSON.stringify({
        title: video.title,
        link: video.link,          // <-- full YouTube URL stored in Convex
        startTime: video.startTime ?? 0,
        endTime: video.endTime ?? 0,
      }),
    };
  } catch (e) {
    return { statusCode: 500, body: 'Server error' };
  }
};

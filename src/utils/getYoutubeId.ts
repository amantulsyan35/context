export function getYouTubeId(url: string): string | null {
  try {
    // youtu.be/<id> - exactly 11 characters
    const short = url.match(/^https?:\/\/youtu\.be\/([A-Za-z0-9_-]{11})(?:\?|$)/i);
    if (short) return short[1];

    // youtube(-nocookie).com/embed/<id> - exactly 11 characters
    const embed = url.match(/youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{11})(?:\?|$)/i);
    if (embed) return embed[1];

    // youtube(-nocookie).com/watch?v=<id>
    const u = new URL(url);
    if (
      (u.hostname.includes('youtube.com') || u.hostname.includes('youtube-nocookie.com'))
    ) {
      const v = u.searchParams.get('v');
      // Validate YouTube ID is exactly 11 characters
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) {
        return v;
      }
    }
    return null;
  } catch (error) {
    console.error('Error parsing YouTube URL:', error);
    return null;
  }
}

export function getYouTubeThumbnail(url: string, quality: 'maxresdefault' | 'hqdefault' | 'mqdefault' | 'sddefault' = 'hqdefault'): string | null {
  const id = getYouTubeId(url);
  if (!id) return null;

  // Use consistent domain with edge function
  // hqdefault (480x360) - most reliable, exists for virtually all videos
  // maxresdefault (1280x720) - high quality but doesn't exist for all videos
  // mqdefault (320x180) - medium quality
  // sddefault (640x480) - standard definition
  return `https://i.ytimg.com/vi/${id}/${quality}.jpg`;
}

export async function getYouTubeSubtitles(
  url: string,
  startTime: number,
  endTime: number
): Promise<string | null> {
  const id = getYouTubeId(url);
  if (!id) return null;

  const qs = new URLSearchParams({
    videoId: id,
    startTime: String(startTime),
    endTime: String(endTime),
  });

  try {
    const res = await fetch(`/.netlify/functions/youtube-transcript?${qs.toString()}`, {
      method: 'GET',
      headers: { Accept: 'text/plain' },
    });
    if (!res.ok) return null;
    const text = await res.text();
    // Return empty string (not null) if nothing found, so we can show a fallback message
    return (text || '').trim();
  } catch (e) {
    console.error('Error fetching YouTube subtitles:', e);
    return null;
  }
}

// Helper function to test if a YouTube thumbnail exists
export async function validateYouTubeThumbnail(videoId: string, quality: 'maxresdefault' | 'hqdefault' | 'mqdefault' | 'sddefault' = 'hqdefault'): Promise<boolean> {
  try {
    const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`;
    const response = await fetch(thumbnailUrl, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

// Helper function to get the best available thumbnail
export async function getBestYouTubeThumbnail(url: string): Promise<string | null> {
  const id = getYouTubeId(url);
  if (!id) return null;

  // Try qualities in order of preference
  const qualities: Array<'maxresdefault' | 'hqdefault' | 'mqdefault' | 'sddefault'> = [
    'maxresdefault',
    'hqdefault', 
    'mqdefault',
    'sddefault'
  ];

  for (const quality of qualities) {
    if (await validateYouTubeThumbnail(id, quality)) {
      return `https://i.ytimg.com/vi/${id}/${quality}.jpg`;
    }
  }

  // Fallback to hqdefault (most reliable)
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

function cldText(t: string) {
  return encodeURIComponent(t)
    .replace(/%2F/g, '%252F') // slash
    .replace(/%2C/g, '%252C'); // comma
}

// Build Cloudinary URL: fetch YT hqdefault + title overlay
export function cloudinaryOgFromYoutube(cloud: string, youtubeUrl: string, title: string) {
  const id = getYouTubeId(youtubeUrl);
  if (!id) return null;
  return (
    `https://res.cloudinary.com/${cloud}/image/fetch/` +
    `w_1200,h_630,c_fill,q_auto,f_jpg/` +
    `l_text:Arial_64_bold:${cldText(title)},co_white,g_south_west,x_64,y_64,w_1000,c_fit/` +
    `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
  );
}
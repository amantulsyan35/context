export function getYouTubeId(url: string): string | null {
  try {
    // youtu.be/<id>
    const short = url.match(/^https?:\/\/youtu\.be\/([A-Za-z0-9_-]{11})/i);
    if (short) return short[1];

    // youtube(-nocookie).com/embed/<id>
    const embed = url.match(/youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{11})/i);
    if (embed) return embed[1];

    // youtube(-nocookie).com/watch?v=<id>
    const u = new URL(url);
    if (
      (u.hostname.includes('youtube.com') || u.hostname.includes('youtube-nocookie.com')) &&
      u.searchParams.get('v')
    ) {
      return u.searchParams.get('v');
    }
    return null;
  } catch {
    return null;
  }
}

export function getYouTubeThumbnail(url: string): string | null {
  const id = getYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/maxresdefault.jpg` : null;
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

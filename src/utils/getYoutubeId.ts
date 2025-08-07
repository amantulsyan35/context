export function getYouTubeId(url: string): string | null {
  // handles both "youtu.be/ID" and "youtube.com/watch?v=ID" (and some embeds)
  const regex =
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/))([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

export function getYouTubeThumbnail(url: string): string | null {
  const videoId = getYouTubeId(url);
  return videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null;
}

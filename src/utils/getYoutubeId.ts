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

export async function getYouTubeSubtitles(url: string, startTime: number, endTime: number): Promise<string | null> {
  const videoId = getYouTubeId(url);
  if (!videoId) return null;

  try {
    // Use a public transcript API that handles CORS
    // This uses the youtubetranscript.com API or similar service
    
    // Option 1: Use a public transcript API
    const transcriptApiUrl = `https://youtubetranscript.com/?server_vid2=${videoId}`;
    
    try {
      const response = await fetch(transcriptApiUrl);
      if (response.ok) {
        const data = await response.json();
        // Process the transcript data and filter by time range
        if (data && data.transcript) {
          const filteredTranscript = data.transcript
            .filter((item: any) => {
              const itemStart = parseFloat(item.start);
              const itemEnd = itemStart + parseFloat(item.duration || 0);
              return (itemStart >= startTime && itemStart <= endTime) ||
                     (itemEnd >= startTime && itemEnd <= endTime) ||
                     (itemStart <= startTime && itemEnd >= endTime);
            })
            .map((item: any) => item.text)
            .join(' ');
          
          return filteredTranscript || null;
        }
      }
    } catch (apiError) {
      console.log('Transcript API failed, trying alternative method');
    }
    
    // Option 2: Use Netlify function as a proxy (if we create one)
    try {
      const proxyResponse = await fetch(`/.netlify/functions/youtube-transcript?videoId=${videoId}&startTime=${startTime}&endTime=${endTime}`);
      if (proxyResponse.ok) {
        const text = await proxyResponse.text();
        return text || null;
      }
    } catch (proxyError) {
      console.log('Proxy function not available');
    }
    
    // Option 3: Fallback - return null (no subtitle)
    return null;
    
  } catch (error) {
    console.error('Error fetching YouTube subtitles:', error);
    return null;
  }
}

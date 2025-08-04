import { api } from '../../convex/_generated/api';
import { useQuerySuspense } from '@/hooks/useSuspenseQuery';
import VideoCard from '@/components/video-card';

import { Link } from '@tanstack/react-router';
import { getYouTubeId } from '@/utils/getYoutubeId';

export function VideoList() {
  const videos = useQuerySuspense(api.videos.getVideos);

  if (!videos) {
    return null;
  }

  return (
    <>
      {videos.map((video) => {
        const ytId = getYouTubeId(video.link);
        const thumbnailUrl = ytId
          ? `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`
          : 'https://linear.app/static/og/homepage-2024.jpg';

        return (
          <Link to='/video/$videoId' params={{ videoId: video._id }} className='block'>
            <VideoCard image={thumbnailUrl} imageAlt={video?.title} title={video?.title || ''} />
          </Link>
        );
      })}
    </>
  );
}

export default VideoList;

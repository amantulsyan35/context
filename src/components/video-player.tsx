import { useQuerySuspense } from '@/hooks/useSuspenseQuery';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import ContextVideoPlayer from './context-video-player';

function VideoPlayer({ videoId }: { videoId: string }) {
  const video = useQuerySuspense(api.videos.getVideoById, {
    id: videoId as Id<'videos'>,
  });

  if (!video) return null;

  return (
    <ContextVideoPlayer
      youtubeUrl={video.link}
      startTime={video.startTime}
      endTime={video.endTime}
    />
  );
}

export default VideoPlayer;

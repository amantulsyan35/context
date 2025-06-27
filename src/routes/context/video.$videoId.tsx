import { createFileRoute, useParams } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';
import React from 'react';
import VideoPlayer from '@/components/video-player';
import { useQuerySuspense } from '@/hooks/useSuspenseQuery';
import { Id } from '../../../convex/_generated/dataModel';
import { api } from '../../../convex/_generated/api';

export const Route = createFileRoute('/context/video/$videoId')({
  component: VideoPage,
});

export function VideoPage() {
  const videoId = useParams({
    from: '/context/video/$videoId',
    select: (params) => params.videoId,
  });

  const video = useQuerySuspense(api.videos.getVideoById, {
    id: videoId as Id<'videos'>,
  });
  if (!video) return null;

  const ytId = new URLSearchParams(new URL(video.link).search).get('v');
  const embedUrl = `https://www.youtube.com/embed/${ytId}?start=${video.startTime}&end=${video.endTime}`;
  const thumbUrl = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;

  return (
    <>
      <Helmet>
        <meta charSet='utf-8' />
        <title>{video.title}</title>
        <link rel='canonical' href={`https://mysite.com/context/video/${videoId}`} />

        {/* tell crawlers this is a video clip */}
        <meta property='og:type' content='video.other' />
        <meta property='og:video' content={embedUrl} />
        <meta property='og:video:secure_url' content={embedUrl} />
        <meta property='og:video:type' content='text/html' />
        <meta property='og:video:width' content='1280' />
        <meta property='og:video:height' content='720' />

        {/* fallback thumbnail */}
        <meta property='og:image' content={thumbUrl} />
        <meta property='og:image:width' content='1280' />
        <meta property='og:image:height' content='720' />
        <meta name='twitter:card' content='player' />
        <meta name='twitter:player' content={embedUrl} />
        <meta name='twitter:player:width' content='1280' />
        <meta name='twitter:player:height' content='720' />
      </Helmet>

      <main className='flex items-center justify-center min-h-screen bg-[#FFFFFF]'>
        <React.Suspense
          fallback={
            <div className='relative w-full max-w-4xl aspect-video overflow-hidden flex items-center justify-center bg-[#111110] rounded-2xl'>
              <p className='text-primary-foreground'>Loading…</p>
            </div>
          }
        >
          <div className='relative w-full max-w-lg sm:max-w-2xl lg:max-w-4xl aspect-video rounded-2xl overflow-hidden shadow-lg'>
            <VideoPlayer videoId={videoId} />
          </div>
        </React.Suspense>
      </main>
    </>
  );
}
export default VideoPage;

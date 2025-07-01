import { createFileRoute, useParams } from '@tanstack/react-router';
import React from 'react';
import VideoPlayer from '@/components/video-player';
import Loading from '@/components/loading';

export const Route = createFileRoute('/video/$videoId')({
  component: VideoPage,
});

export function VideoPage() {
  const videoId = useParams({
    from: '/video/$videoId',
    select: (params) => params.videoId,
  });

  return (
    <main className='flex items-center justify-center min-h-screen bg-[#FFF8E7] px-4 sm:px-6 lg:px-8'>
      <React.Suspense
        fallback={
          <div className='flex items-center justify-center relative w-full max-w-xs sm:max-w-md lg:max-w-2xl xl:max-w-4xl aspect-video rounded-2xl overflow-hidden shadow-lg'>
            <Loading />
          </div>
        }
      >
        <div className='relative w-full max-w-xs sm:max-w-md lg:max-w-2xl xl:max-w-4xl aspect-video rounded-2xl overflow-hidden shadow-lg'>
          <VideoPlayer videoId={videoId} />
        </div>
      </React.Suspense>
    </main>
  );
}
export default VideoPage;

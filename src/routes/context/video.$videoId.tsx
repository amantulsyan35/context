import { createFileRoute, useParams } from '@tanstack/react-router';

import React from 'react';
import VideoPlayer from '@/components/video-player';

export const Route = createFileRoute('/context/video/$videoId')({
  component: VideoPage,
});

export function VideoPage() {
  const videoId = useParams({
    from: '/context/video/$videoId',
    select: (params) => params.videoId,
  });

  return (
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
  );
}
export default VideoPage;

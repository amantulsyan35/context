import VideoCardSkeleton from '@/components/skeleton/video-card-skeleton';
import VideoList from '@/components/video-list';
import { createFileRoute } from '@tanstack/react-router';
import React from 'react';

export const Route = createFileRoute('/')({
  component: Index,
});

export function Index() {
  return (
    <main className='min-h-screen bg-[#0D0D0D] text-white'>
      <section className='flex flex-col items-start py-12 px-48 bg-[#111110]'>
        <div className='mt-32'>
          <h1 className='text-6xl font-extralight font-inter mb-1'>Context</h1>
          <p className='text-primary-foreground font-extralight font-inter text-md'>
            Sharing Narratives.
          </p>
        </div>
      </section>

      <hr className='w-full border-t border-zinc-800 mb-8' />

      <section className='px-48 mx-auto'>
        <div className='grid grid-cols-3 gap-8'>
          <React.Suspense fallback={<VideoCardSkeleton />}>
            <VideoList />
          </React.Suspense>
        </div>
      </section>
    </main>
  );
}

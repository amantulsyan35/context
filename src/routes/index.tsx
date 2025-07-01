import VideoCardSkeleton from '@/components/skeleton/video-card-skeleton';
import VideoList from '@/components/video-list';
import { createFileRoute } from '@tanstack/react-router';
import React from 'react';

export const Route = createFileRoute('/')({
  component: Index,
});

export function Index() {
  return (
    <main className=' h-screen bg-[#0D0D0D] text-white'>
      <section className='flex flex-col items-start py-12 px-48 bg-[#111110]'>
        <div className='mt-32'>
          <h1 className='text-6xl font-extralight font-inter mb-1'>Self Atlas</h1>
          <p className='text-primary-foreground font-extralight font-inter text-md'>
            Collection of narratives
          </p>
        </div>
      </section>

      <hr className='w-full border-t border-zinc-800 mb-8' />

      <section className='flex-1 px-48 mx-auto pb-16 overflow-auto'>
        <div className='grid grid-cols-3 gap-8'>
          <React.Suspense
            fallback={
              <>
                {Array.from({ length: 3 }).map((_, i) => (
                  <VideoCardSkeleton key={i} />
                ))}
              </>
            }
          >
            <VideoList />
          </React.Suspense>
        </div>
      </section>
    </main>
  );
}

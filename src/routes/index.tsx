import VideoCardSkeleton from '@/components/skeleton/video-card-skeleton';
import VideoList from '@/components/video-list';
import { createFileRoute } from '@tanstack/react-router';
import { api } from '../../convex/_generated/api';
import { useQuery } from 'convex/react';
import React from 'react';

function SkeletonGrid({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <VideoCardSkeleton key={i} />
      ))}
    </>
  );
}

export const Route = createFileRoute('/')({
  component: Index,
});

export function Index() {
  // No need to error handle this
  const count = useQuery(api.videos.getVideosCount);

  const skeletonCount = count ?? 6;

  return (
    <main className=' min-h-screen bg-[#0D0D0D] text-white'>
      <section className='flex flex-col items-start py-12 px-48 bg-[#111110]'>
        <div className='mt-32'>
          <h1 className='text-6xl font-extralight font-inter mb-1'>Self Atlas</h1>
          <p className='text-primary-foreground font-extralight font-inter text-md'>
            Collection of narratives
          </p>
        </div>
      </section>

      <hr className='w-full border-t border-zinc-800 mb-8' />

      <section className='flex-1 px-48 mx-auto pb-16 overflow-y-auto'>
        <div className='grid grid-cols-3 gap-8'>
          <React.Suspense fallback={<SkeletonGrid count={skeletonCount} />}>
            <VideoList />
          </React.Suspense>
        </div>
      </section>
    </main>
  );
}

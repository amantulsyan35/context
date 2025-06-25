const VideoCardSkeleton = () => (
  <div className='rounded-2xl border border-zinc-800 bg-[#111110] p-6 flex flex-col gap-4 h-full animate-pulse'>
    <div className='w-full aspect-[16/9] rounded-xl bg-zinc-800' />
    <div className='h-4 bg-zinc-800 rounded w-3/4' />
  </div>
);

export default VideoCardSkeleton;

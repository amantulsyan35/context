import { createFileRoute } from '@tanstack/react-router';
import { HardDriveDownload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VideoLayout } from '@/components/layout/video-layout';
import { useEffect } from 'react';

export const Route = createFileRoute('/')({
  component: Index,
});

export function Index() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'c') {
        if (
          event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement ||
          (event.target as HTMLElement).contentEditable === 'true'
        ) {
          return;
        }

        event.preventDefault();
        window.open('https://x.com/at_aman35/status/1615048552077721601', '_blank');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <VideoLayout
      videoUrl="https://youtu.be/3jzWk00x51A?si=FvtROsTIvf9fHuAv"
      startTime={48}
      endTime={120}
      playbackRate={0.5}
    >
      <hgroup className="mb-6 sm:mb-8 px-4 sm:px-0">
        <h1 className="text-3xl text-center sm:text-left  sm:text-4xl lg:text-5xl font-inter text-white tracking-tight leading-tight">
          Self Atlas
        </h1>
        <p className="font-inter text-center sm:text-left font-extralight text-sm sm:text-lg leading-5 sm:leading-6 text-white mt-3 sm:mt-4 max-w-full sm:max-w-xl">
          In a world overflowing with information, true knowledge is often lost in the noise. We consume vast amounts of content daily, yet only fragments stay with us. This project is a collection of fragments that have taken up headspace in my mind.
        </p>
      </hgroup>

      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mb-4 px-4 sm:px-0">
        <Button
          asChild
          variant="ghost"
          className="bg-white text-black hover:bg-white hover:text-black opacity-90 hover:opacity-100 rounded-lg px-4 sm:px-6 py-2  h-auto group transition-opacity text-sm sm:text-base"
        >
          <a
            href="https://x.com/at_aman35/status/1615048552077721601"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            <HardDriveDownload
              className="w-4 h-4 group-hover:scale-110 transition-transform flex-shrink-0"
              fill="currentColor"
            />
            <span className="font-medium">Get Context</span>
            <kbd className="hidden sm:inline-block ml-2 px-2 py-0.5 text-xs bg-gray-200 rounded">
              C
            </kbd>
          </a>
        </Button>
      </div>
    </VideoLayout>
  );
}

import { createFileRoute, useParams } from '@tanstack/react-router';
import { Play, Youtube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from 'convex/react';
import { Id } from '../../convex/_generated/dataModel';
import { api } from '../../convex/_generated/api';
import { VideoLayout } from '@/components/layout/video-layout';
import { useEffect, useState } from 'react';
import ContextVideoPlayer from '@/components/context-video-player';
import { cn } from '@/lib/utils';
import { getYouTubeThumbnail } from '@/utils/getYoutubeId';

// Utility: Format duration based on start/end
function formatRunTime(start: number, end: number): string {
  const duration = Math.max(0, end - start);
  return duration < 60 ? `${duration}s` : `${Math.floor(duration / 60)}m`;
}

// Utility: Convert _creationTime into readable format
function formatConvexCreationTime(raw: number): string {
  const timestamp = Math.floor(raw);
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export const Route = createFileRoute('/$videoId')({
  component: VideoPage,
});

function VideoPage() {
  const videoId = useParams({
    from: '/$videoId',
    select: (params) => params.videoId,
  });

  const video = useQuery(api.videos.getVideoById, {
    id: videoId as Id<'videos'>,
  });

  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'p' && !isPlayerOpen) {
        if (
          event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement ||
          (event.target as HTMLElement).contentEditable === 'true'
        ) {
          return;
        }
        event.preventDefault();
        setIsPlayerOpen(true);
      }

      if (event.key === 'Escape' && isPlayerOpen) {
        setIsPlayerOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPlayerOpen]);

  // Update meta tags when video data loads
  useEffect(() => {
    if (!video) return;

    const thumbnailUrl = getYouTubeThumbnail(video.link);
    if (!thumbnailUrl) return;

    // Update document title
    document.title = `${video.title} - Context`;

    // Update or create Open Graph meta tags
    const updateMetaTag = (property: string, content: string) => {
      let meta = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('property', property);
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    const updateNameMetaTag = (name: string, content: string) => {
      let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', name);
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    // Open Graph tags
    updateMetaTag('og:title', video.title);
    updateMetaTag('og:description', `Watch "${video.title}" - Context sharing made simple`);
    updateMetaTag('og:image', thumbnailUrl);
    updateMetaTag('og:image:secure_url', thumbnailUrl);
    updateMetaTag('og:url', window.location.href);
    updateMetaTag('og:type', 'video.other');

    // Twitter Card tags
    updateNameMetaTag('twitter:card', 'summary_large_image');
    updateNameMetaTag('twitter:title', video.title);
    updateNameMetaTag('twitter:description', `Watch "${video.title}" - Context sharing made simple`);
    updateNameMetaTag('twitter:image', thumbnailUrl);

    // Signal that the page is ready for prerendering
    if (typeof window !== 'undefined') {
      (window as any).prerenderReady = true;
    }

    // Cleanup function to reset meta tags on component unmount
    return () => {
      document.title = 'Context';
      // Note: We don't remove the meta tags on unmount as they should persist for sharing
    };
  }, [video]);

  if (!video) return null;

  return (
    <>
      <VideoLayout
        videoUrl={video.link}
        startTime={video.startTime}
        endTime={video.endTime}
        playbackRate={0.5}
      >
        <div className="px-4 sm:px-0">
          <hgroup className="mb-6 sm:mb-8">
            <h1 className="text-3xl text-center sm:text-left sm:text-4xl lg:text-5xl font-inter text-white tracking-tight leading-tight break-words">
              {video.title}
            </h1>
          </hgroup>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mb-4 sm:mb-6">
            <Button
              variant="ghost"
              className="bg-white text-black hover:bg-white hover:text-black opacity-90 hover:opacity-100 rounded-lg px-4 sm:px-6 py-2 h-auto group transition-opacity text-sm sm:text-base"
              onClick={() => setIsPlayerOpen(true)}
              aria-label="Play video"
            >
              <Play 
                className="w-4 h-4 group-hover:scale-110 transition-transform flex-shrink-0" 
                fill="currentColor" 
              />
              <span className="font-medium ml-1">Play</span>
              <kbd className="hidden sm:inline-block ml-2 px-2 py-0.5 text-xs bg-gray-200 rounded">
                P
              </kbd>
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs sm:text-sm text-gray-300">
            <time dateTime={new Date(video._creationTime).toISOString()}>
              {formatConvexCreationTime(video._creationTime)}
            </time>
            
            <a
              href={video.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-8 h-8 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full transition-colors"
              aria-label="Watch on YouTube"
            >
              <Youtube className="w-4 h-4" />
            </a>
            
            <span className="text-gray-400">·</span>
            
            <time>{formatRunTime(video.startTime, video.endTime)}</time>
          </div>
        </div>
      </VideoLayout>

      {/* Video Player Modal */}
      <div
        className={cn(
          'fixed inset-0 z-50 transition-all duration-500 flex items-center justify-center',
          isPlayerOpen 
            ? 'opacity-100 pointer-events-auto' 
            : 'opacity-0 pointer-events-none'
        )}
        aria-hidden={!isPlayerOpen}
      >
        <div 
          className="absolute inset-0" 
          onClick={() => setIsPlayerOpen(false)} 
          aria-label="Backdrop"
        >
          <div className="absolute inset-0 bg-black/80" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/40" />
          <div className="absolute inset-0 bg-gradient-radial from-transparent via-black/20 to-black/60" />
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.5'/%3E%3C/svg%3E")`,
            }}
          />
          <div className="absolute inset-0 backdrop-blur-md" />
        </div>

        <div
          className="relative w-full max-w-[95vw] sm:max-w-[90vw] lg:max-w-[85vw] aspect-video rounded-lg sm:rounded-xl overflow-hidden shadow-2xl transition-all duration-500 ease-out"
          onClick={(e) => e.stopPropagation()}
        >
          {isPlayerOpen && (
            <ContextVideoPlayer 
              youtubeUrl={video.link} 
              startTime={video.startTime} 
              endTime={video.endTime} 
            />
          )}
        </div>
      </div>
    </>
  );
}

export default VideoPage;
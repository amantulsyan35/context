import { useRef, useState, useCallback, ReactNode, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { Link, useParams, useRouter } from '@tanstack/react-router';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  CarouselApi
} from '@/components/ui/carousel';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { getYouTubeId } from '@/utils/getYoutubeId';
import { cn } from '@/lib/utils';
import { Id } from '../../../convex/_generated/dataModel';

interface VideoLayoutProps {
  videoUrl: string;
  startTime?: number;
  endTime?: number;
  playbackRate?: number;
  children: ReactNode;
}

export function VideoLayout({
  videoUrl,
  startTime,
  endTime,
  playbackRate = 0.5,
  children,
}: VideoLayoutProps) {
  const params = useParams({ strict: false });
  const activeVideoId = params.videoId as string | undefined;
  const router = useRouter();

  const videos = useQuery(api.videos.getVideos);
  const [isPlaying, setIsPlaying] = useState(true);
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [hasError, setHasError] = useState(false);
  const [key, setKey] = useState(0);
  const [hoveredVideoId, setHoveredVideoId] = useState<string | null>(null);
  const playerRef = useRef<ReactPlayer>(null);

  // Preload video data when hovering
  useQuery(
    api.videos.getVideoById,
    hoveredVideoId ? { id: hoveredVideoId as Id<'videos'> } : "skip"
  );

  // Preload adjacent videos when active video changes
  useEffect(() => {
    if (!videos || !activeVideoId) return;

    const currentIndex = videos.findIndex(v => v._id === activeVideoId);
    if (currentIndex === -1) return;

  }, [activeVideoId, videos, ]);

  const handleReady = useCallback(() => {
    setIsPlaying(true);
  }, []);

  const handleError = useCallback(() => {
    console.error('Video failed to load');
    setHasError(true);
  }, []);

  const preloadVideo = useCallback((videoId: string) => {

    setHoveredVideoId(videoId);


    router.preloadRoute({
      to: '/$videoId',
      params: { videoId },
    }).catch(() => {
      // Silent fail - route might not exist yet
    });
  }, [router]);

  useEffect(() => {
    if (!videos || !activeVideoId || !carouselApi) return;
    const index = videos.findIndex(v => v._id === activeVideoId);
    if (index >= 0) {
      carouselApi.scrollTo(index); // jump=false by default; keeps your smooth opts
    }
  }, [activeVideoId, videos, carouselApi]);

  if (!videos) return null;

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Video Background Container */}
      <div className="fixed inset-0 w-full h-full -z-10">
        {/* React Player Video */}
        {!hasError && (
          <div className="absolute inset-0 w-full h-full">
            <ReactPlayer
              key={key}
              ref={playerRef}
              url={videoUrl}
              playing={isPlaying}
              loop={false}
              muted
              volume={0}
              playbackRate={playbackRate}
              width="100%"
              height="100%"
              progressInterval={100}
              onReady={handleReady}
              onError={handleError}
              onEnded={() => setKey((prev) => prev + 1)}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                minWidth: '100%',
                minHeight: '100%',
              }}
              config={{
                youtube: {
                  playerVars: {
                    disablekb: 1,
                    controls: 0,
                    start: startTime,
                    end: endTime,
                    modestbranding: 1,
                    showinfo: 0,
                    rel: 0,
                    iv_load_policy: 3,
                    autoplay: 1,
                    mute: 1,
                    playsinline: 1,
                    origin: window.location.origin,
                    // Performance optimizations
                    host: 'https://www.youtube-nocookie.com',
                    widget_referrer: window.location.origin,
                  },
                  embedOptions: {
                    host: 'https://www.youtube-nocookie.com',
                  },
                },
              }}
            />
          </div>
        )}

        {/* Blur and Gradient Overlays */}
        <div className="absolute inset-0 backdrop-blur-sm bg-black/30" />
        <div className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-black/80 via-black/40 to-transparent" />
      </div>

      <div className="relative z-10 flex flex-col w-full min-h-screen pl-4 sm:pl-12 lg:pl-60">
       
        <div className="flex-1 flex flex-col justify-center">
          <div className="max-w-4xl w-full flex flex-col">{children}</div>
        </div>

        <div className="pb-8">
        <Carousel
            setApi={setCarouselApi}
            opts={{
              duration: 20,
              align: 'start',
              containScroll: 'trimSnaps',
              dragFree: true,
              skipSnaps: false,
            }}
            plugins={[
              WheelGesturesPlugin({
                forceWheelAxis: 'x',
                wheelDraggingClass: 'is-wheel-dragging',
              }),
            ]}
            className="w-full pr-8"
          >
            {/* Navigation Controls */}
            <div className="flex items-center gap-2 mb-4">
              <CarouselPrevious
                className="relative top-0 left-0 translate-y-0 translate-x-0 h-8 w-8 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-full text-white hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                variant="ghost"
                size="icon"
              />
              <CarouselNext
                className="relative top-0 left-0 translate-y-0 translate-x-0 h-8 w-8 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-full text-white hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                variant="ghost"
                size="icon"
              />
            </div>

            <CarouselContent className="-ml-8">
              {videos.map((video) => {
                const isActive = activeVideoId ? video._id === activeVideoId : false;
                const ytId = getYouTubeId(video.link);
                const thumbnailUrl = ytId
                  ? `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`
                  : 'https://linear.app/static/og/homepage-2024.jpg';

                return (
                  <CarouselItem
                    key={video._id}
                    className={cn(
                      "pl-8 transition-all duration-500 ease-out",
                      // responsive basis so mobile shrinks but desktop stays
                      "basis-[45%] sm:basis-1/5",
                      isActive ? "z-10" : "hover:scale-95"
                    )}
                  >
                    <Link
                      to="/$videoId"
                      params={{ videoId: video._id }}
                      className="group cursor-pointer block"
                      data-active={isActive}
                      data-available="true"
                      preload="intent"
                      onMouseEnter={() => preloadVideo(video._id)}
                      onFocus={() => preloadVideo(video._id)}
                      onClick={() => {
                        if (!videos || !carouselApi) return;
                        const idx = videos.findIndex(v => v._id === video._id);
                        if (idx >= 0) carouselApi.scrollTo(idx);
                      }}
                    >
                      <div
                        className={cn(
                          "relative aspect-video bg-black rounded-xl overflow-hidden w-full transition-all duration-500 ease-out transform-gpu",
                          isActive ? "shadow-2xl" : ""
                        )}
                      >
                        <img
                          src={thumbnailUrl}
                          alt={video.title}
                          className={cn(
                            "w-full h-full object-cover transition-all scale-110 duration-500",
                            isActive ? "opacity-100" : "opacity-50 group-hover:opacity-70"
                          )}
                          loading="lazy"
                          decoding="async"
                        />
                      </div>

                      <div
                        className={cn(
                          "mt-3 px-1 transition-all duration-500",
                          isActive ? "opacity-100" : "opacity-60"
                        )}
                      >
                        <p
                          className={cn(
                            "font-berkeley-mono uppercase leading-[14px] transition-all duration-500",
                            isActive
                              ? "text-white text-[12px] font-semibold"
                              : "text-gray-400 text-[11px] group-hover:text-gray-200"
                          )}
                        >
                          {video.title}
                        </p>
                      </div>
                    </Link>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
          </Carousel>
        </div>
      </div>
    </div>
  );
}
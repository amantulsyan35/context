import React, { useRef, useState, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { PlayIcon, PauseIcon } from '@heroicons/react/24/solid';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectValue,
} from './ui/select';

interface VideoPlayerProps {
  youtubeUrl: string;
  startTime: number;
  endTime: number;
}

const ContextVideoPlayer: React.FC<VideoPlayerProps> = ({ youtubeUrl, startTime, endTime }) => {
  const playerRef = useRef<ReactPlayer>(null);

  const [playing, setPlaying] = useState(true); // Start playing automatically

  const [playbackRate, setPlaybackRate] = useState(1);

  const [currentSeconds, setCurrentSeconds] = useState(startTime);

  const clipDuration = endTime - startTime;

  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.seekTo(startTime, 'seconds');
      setCurrentSeconds(startTime);
    }
  }, [startTime]);

  const handleProgress = ({ playedSeconds }: { playedSeconds: number }) => {
    if (playedSeconds >= endTime) {
      // Loop back to start instead of stopping
      playerRef.current?.seekTo(startTime, 'seconds');
      setCurrentSeconds(startTime);
    } else if (playedSeconds >= startTime) {
      setCurrentSeconds(playedSeconds);
    }
  };

  const handlePlayPause = () => {
    if (!playing && currentSeconds >= endTime) {
      playerRef.current?.seekTo(startTime, 'seconds');
      setCurrentSeconds(startTime);
    }
    setPlaying((p) => !p);
  };

  const handleSeek = (seconds: number) => {
    const clampedSeconds = Math.max(startTime, Math.min(endTime, seconds));
    setCurrentSeconds(clampedSeconds);
    playerRef.current?.seekTo(clampedSeconds, 'seconds');
  };

  const handleEnded = () => {
    // Loop back to start
    playerRef.current?.seekTo(startTime, 'seconds');
    setCurrentSeconds(startTime);
    setPlaying(true);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <>
      <ReactPlayer
        ref={playerRef}
        id='video-player-wrapper'
        width='100%'
        height='100%'
        url={youtubeUrl}
        playing={playing}
        controls={false}
        onEnded={handleEnded}
        progressInterval={100}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        playbackRate={playbackRate}
        onProgress={handleProgress}
        config={{
          youtube: {
            playerVars: {
              start: startTime,
              end: endTime,
              controls: 0,
              modestbranding: 1,
              rel: 0,
              autoplay: 1,
              loop: 1,
              playlist: youtubeUrl.split('v=')[1]?.split('&')[0], // For looping
            },
          },
        }}
      />

      <div className='absolute bottom-0 left-0 right-0 p-2 sm:p-4 flex flex-col gap-2 z-10'>
        <div className='flex items-center justify-between gap-2 sm:gap-4'>
          <div className='flex items-center gap-1 sm:gap-2'>
            <Button variant='secondary' size='sm' onClick={handlePlayPause} className='text-white'>
              {playing ? (
                <PauseIcon className='size-4 text-primary' />
              ) : (
                <PlayIcon className='size-4 text-primary' />
              )}
            </Button>

            <div className='bg-primary-foreground rounded-full px-3 sm:px-4 py-1 sm:py-2'>
              <p className='text-primary text-xs sm:text-sm'>
                {formatTime(Math.max(currentSeconds - startTime, 0))} / {formatTime(clipDuration)}
              </p>
            </div>
          </div>

          <div className='flex items-center gap-2'>
            <Select
              value={playbackRate.toString()}
              onValueChange={(val) => setPlaybackRate(parseFloat(val))}
            >
              <SelectTrigger
                size='sm'
                className='bg-primary-foreground text-primary text-xs sm:text-sm'
              >
                <SelectValue placeholder={`${playbackRate}×`} />
              </SelectTrigger>

              <SelectContent>
                <SelectGroup>
                  {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                    <SelectItem key={rate} value={rate.toString()}>
                      {rate}×
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Slider
          min={0}
          step={0.1}
          _trackClassName='bg-primary'
          _rangeClassName='bg-primary-foreground'
          max={clipDuration}
          value={[Math.min(Math.max(currentSeconds - startTime, 0), clipDuration)]}
          onValueChange={([offset]) => {
            const newTime = startTime + offset;
            handleSeek(newTime);
          }}
          className='w-full [&_[data-slot=slider-thumb]]:hidden rounded-full'
        />
      </div>
    </>
  );
};

export default ContextVideoPlayer;
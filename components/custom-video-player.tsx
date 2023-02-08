import React, { useState, useRef } from 'react';
import ReactPlayer from 'react-player';
import {
  BsPlayFill,
  BsPause,
  // BsFillVolumeDownFill,
  BsFullscreen,
} from 'react-icons/bs';
import Slider from '@material-ui/core/Slider';
import screenfull from 'screenfull';
import Loading from './loading';

interface CustomVideoPlayerProps {
  videoData:
    | {
        id: string;
        endTime: number;
        startTime: number;
        updatedAt: Date;
        youtubeLink: string;
      }
    | any;
}

const CustomVideoPlayer = ({ videoData }: CustomVideoPlayerProps) => {
  const [state, setState] = useState({
    playing: false,
    volume: 0.5,
    played: 0,
    seeking: false,
  });
  const [seekPosition, setSeekPosition] = useState(15);

  const playerControlRef = useRef<null | any>(null);
  const playerRef = useRef<null | any>(null);

  const { playing, volume, played } = state;

  const handlePlayingStart = () => {
    setState({ ...state, playing: true });
  };

  const handlePlayingPause = () => {
    setState({ ...state, playing: false });
  };

  // console.log(videoData);

  // const handleVolumeChange = (e: any, newValue: any) => {
  //   setState({ ...state, volume: newValue });
  // };

  // const handleVolumeSeekUp = (e: any, newValue: any) => {
  //   setState({ ...state, volume: newValue });
  // };

  const handleToggleFullScreen = () => {
    screenfull.toggle(playerControlRef?.current);
  };

  if (!videoData?.startTime || !videoData?.endTime) {
    return <Loading />;
  }

  return (
    <div ref={playerControlRef} className='w-full h-full relative'>
      <ReactPlayer
        ref={playerRef}
        width='100%'
        height='100%'
        url={videoData?.youtubeLink}
        muted={false}
        playing={playing}
        volume={volume}
        loop={true}
        onEnded={() => setState({ ...state, playing: false })}
        onProgress={(e) => setSeekPosition(e.playedSeconds)}
        played={played * 100}
        config={{
          youtube: {
            playerVars: {
              start: videoData?.startTime,
              end: videoData?.endTime,
            },
          },
        }}
      />

      <div
        className={
          state.playing
            ? 'absolute top-0 right-0 bottom-0 left-0 flex flex-col justify-between z-10'
            : 'absolute top-0 right-0 bottom-0 left-0 flex flex-col justify-between z-10 bg-black/[0.6]'
        }
      >
        <div className='mt-auto flex flex-col justify-between items-center p-8'>
          <div className='w-full'>
            <Slider
              min={videoData?.startTime}
              max={videoData?.endTime}
              value={seekPosition}
              onChange={(_, v) => playerRef.current.seekTo(v)}
            />
          </div>
          <div className='flex flex-row items-center justify-between w-full'>
            <div className='flex flex-row items-center '>
              {state.playing ? (
                <BsPause
                  onClick={handlePlayingPause}
                  className='text-[#999] hover:text-[#fff] text-[40px]'
                />
              ) : (
                <BsPlayFill
                  onClick={handlePlayingStart}
                  className='text-[#999] hover:text-[#fff] text-[40px]'
                />
              )}

              {/* <BsFillVolumeDownFill className='text-[#999] hover:text-[#fff] text-[40px] ' />
              <Slider
                min={0}
                max={100}
                value={volume * 100}
                onChange={handleVolumeChange}
                onChangeCommitted={handleVolumeSeekUp}
                className='w-[100%]'
              /> */}

              {/* <button className='text-[#fff] ml-[16px]'>
              <p>
                {elapsedTime}/{totalDuration}
              </p>
            </button> */}
            </div>
            <BsFullscreen
              onClick={handleToggleFullScreen}
              className='text-[#999] border-5 border-white hover:text-[#fff] text-[30px]'
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomVideoPlayer;

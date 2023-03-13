import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { trpc } from '../../utils/trpc';
import { useRouter } from 'next/router';
import Draggable from 'react-draggable';
import CustomVideoPlayer from '../../../components/custom-video-player';

const VideoPage = () => {
  const id = useRouter().query.id as string;
  const [hasWindow, setHasWindow] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHasWindow(true);
    }
  }, []);

  // EXCALIDRAW CLIENT LOGIC

  const [Excalidraw, setExcalidraw] = useState<null | any>(null);
  useEffect(() => {
    import('@excalidraw/excalidraw').then((comp) =>
      setExcalidraw(comp.Excalidraw)
    );
  }, [Excalidraw]);

  const videoDetails: any = trpc.video.getVideoDetails.useQuery({
    id,
  });

  console.log(videoDetails?.data);

  return (
    <main>
      <div className='h-[30rem] flex flex-col items-center justify-center relative'>
        {Excalidraw && (
          <Excalidraw
            theme='dark'
            initialData={{
              elements: videoDetails?.data?.canvasState?.excalidrawState,
              appState: {
                detectScroll: true,
                viewModeEnabled: true,
              },
              scrollToContent: true,
            }}
          />
        )}
        <Draggable>
          <div className='h-[30rem] w-[50rem] absolute -bottom-1/2 bg-slate-50 rounded-md shadow-md flex flex-col items-center justify-center p-4 gap-8 cursor-pointer z-10'>
            {hasWindow && <CustomVideoPlayer videoData={videoDetails?.data} />}
          </div>
        </Draggable>
      </div>
    </main>
  );
};

export default VideoPage;

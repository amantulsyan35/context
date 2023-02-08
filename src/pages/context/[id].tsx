import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { trpc } from '../../utils/trpc';
import { useRouter } from 'next/router';
import Draggable from 'react-draggable';
import rough from 'roughjs/bundled/rough.cjs';
import CustomVideoPlayer from '../../../components/custom-video-player';

const generator = rough.generator();

type elementType = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  roughElement: any;
};

const VideoPage = () => {
  const id = useRouter().query.id as string;
  const [isCanvasExperimenting, setIsCanvasExperimenting] = useState(true);
  const [elements, setElements] = useState<elementType[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [hasWindow, setHasWindow] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHasWindow(true);
    }
  }, []);

  const videoDetails = trpc.video.getVideoDetails.useQuery({
    id,
  });

  //CANVAS LOGIC

  useLayoutEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      let dpi = window.devicePixelRatio;

      let style_height = +getComputedStyle(canvas)
        .getPropertyValue('height')
        .slice(0, -2);
      let style_width = +getComputedStyle(canvas)
        .getPropertyValue('width')
        .slice(0, -2);

      canvas.setAttribute('height', (style_height * dpi).toString());
      canvas.setAttribute('width', (style_width * dpi).toString());

      if (context) {
        // const roughCanvas = rough.canvas(canvas);
        // elements.forEach(({ roughElement }) => roughCanvas.draw(roughElement));
      }
    }
  }, [elements]);

  function computePointInCanvas(clientX: any, clientY: any) {
    if (canvasRef.current) {
      const boundingRect = canvasRef.current?.getBoundingClientRect();

      return {
        x: clientX - boundingRect?.left,
        y: clientY - boundingRect?.top,
      };
    }
    return null;
  }

  const handleMouseDown = (event: any) => {
    setDrawing(true);
    //
  };

  const handleMouseMove = (event: any) => {
    if (!drawing) return;
    //
  };

  const handleMouseUp = () => {
    setDrawing(false);
  };

  if (isCanvasExperimenting) {
    return (
      <main>
        <div className=' h-[25rem] flex flex-col items-center justify-center relative bg-[#C2262E]'>
          <canvas
            ref={canvasRef}
            id='canvas'
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className='h-[25rem] w-full overflow-y-scroll flex  gap-4 flex-wrap justify-center p-4 bg-[#C2262E]'
          />
          <Draggable>
            <div className='h-[30rem] w-[50rem] absolute -bottom-[15rem] bg-slate-50 rounded-md shadow-md flex flex-col items-center justify-center p-4 gap-8 cursor-pointer'>
              {hasWindow && (
                <CustomVideoPlayer videoData={videoDetails?.data} />
              )}
            </div>
          </Draggable>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className=' h-[25rem] flex flex-col items-center justify-center relative bg-[#C2262E]'>
        <section className='h-[25rem] w-full overflow-y-scroll flex  gap-4 flex-wrap justify-center p-4 bg-[#C2262E]'></section>
        <Draggable>
          <div className='h-[30rem] w-[50rem] absolute -bottom-[15rem] bg-slate-50 rounded-md shadow-md flex flex-col items-center justify-center p-4 gap-8 cursor-pointer'>
            {hasWindow && <CustomVideoPlayer videoData={videoDetails?.data} />}
          </div>
        </Draggable>
      </div>
    </main>
  );
};

export default VideoPage;

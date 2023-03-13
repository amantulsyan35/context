import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAtom } from 'jotai';
import Draggable from 'react-draggable';
import Loading from '../../../components/loading';
import { GoBackButton } from '../../../components/button';
import { excalidrawStateAtom } from '../../../atoms/video-atoms';
import { pageAtom, Page } from '../../../atoms/page-atoms';
import YoutubeLinkSection from '../../../components/youtube-link-section';
import SelectContextSection from '../../../components/select-context-selection';

const NewContext = () => {
  const router = useRouter();
  const [page, setPage] = useAtom(pageAtom);
  const [excalidrawState, setExcalidrawState] = useAtom(excalidrawStateAtom);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handleStart = (url: string) =>
      url !== router.asPath && setIsLoading(true);
    const handleComplete = (url: string) =>
      url === router.asPath && setIsLoading(false);

    router.events.on('routeChangeStart', handleStart);
    router.events.on('routeChangeComplete', handleComplete);
    router.events.on('routeChangeError', handleComplete);

    return () => {
      router.events.off('routeChangeStart', handleStart);
      router.events.off('routeChangeComplete', handleComplete);
      router.events.off('routeChangeError', handleComplete);
    };
  });

  // EXCALIDRAW CLIENT LOGIC

  const [Excalidraw, setExcalidraw] = useState<null | any>(null);
  useEffect(() => {
    import('@excalidraw/excalidraw').then((comp) =>
      setExcalidraw(comp.Excalidraw)
    );
  }, []);

  const handleBack = () => {
    setPage(Page.youtubeLink);
  };

  if (isLoading) {
    return (
      <main>
        <section className=' h-[25rem] flex flex-col items-center justify-center relative bg-[#C2262E] '>
          <div className='h-[30rem] w-[50rem] absolute  -bottom-[15rem] bg-slate-50 rounded-md shadow-md flex flex-col items-center justify-center p-4 gap-8'>
            <Loading />
          </div>
        </section>
      </main>
    );
  }

  if (page === Page.youtubeLink) {
    return (
      <main className='relative flex justify-center items-center'>
        <section className='h-[25rem] w-full overflow-y-scroll flex  gap-4 flex-wrap justify-center p-4 bg-[#C2262E]'></section>
        <div className='h-[30rem] cursor-pointer w-[50rem] absolute -bottom-[15rem]  bg-slate-50 rounded-md shadow-md flex flex-col items-center justify-center p-4 gap-8'>
          <YoutubeLinkSection />
        </div>
      </main>
    );
  }

  if (page === Page.generateContext) {
    const handleExcalidrawChange = (e: any) => {
      setExcalidrawState(e);
    };

    return (
      <main>
        <div className=' h-[30rem] flex flex-col items-center justify-center relative'>
          {Excalidraw && (
            <Excalidraw theme='dark' onChange={handleExcalidrawChange} />
          )}
          <Draggable>
            <div className='h-[30rem] w-[50rem] absolute -bottom-1/2 bg-slate-50 rounded-md shadow-md flex flex-col items-center justify-center p-4 gap-8 cursor-pointer z-10'>
              <GoBackButton handleBack={handleBack} />
              <SelectContextSection />
            </div>
          </Draggable>
        </div>
      </main>
    );
  }

  return null;
};

export default NewContext;

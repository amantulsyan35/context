import { RxVideo } from 'react-icons/rx';

const Loading = () => {
  return (
    <div className='text-center'>
      <div role='status'>
        <RxVideo className='inline mr-2 w-8 h-8  text-[#C2262E] animate-ping ' />
        <span className='sr-only'>Loading...</span>
      </div>
    </div>
  );
};

export default Loading;

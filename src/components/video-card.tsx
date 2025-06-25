interface CardProps {
  image: string;
  imageBg?: string;
  imageAlt?: string;
  title: string;
}

const VideoCard = ({ image, imageAlt = '', title }: CardProps) => (
  <div className='rounded-2xl w-full border border-zinc-800 bg-[#111110] p-6 flex gap-4 flex-col h-full hover:border-zinc-700'>
    <div
      onClick={() => {
        console.log('clicked');
      }}
      className='relative w-full aspect-[16/9] rounded-xl overflow-hidden border-2 border-secondary-foreground ring-2 ring-secondary-foreground ring-offset-4 ring-offset-[#111110] cursor-pointer'
    >
      <img
        src={image}
        alt={imageAlt}
        className='w-full h-full object-cover rounded-lg opacity-80 hover:opacity-100 transition-opacity duration-200'
      />
    </div>
    <h3 className='text-secondary font-inter text-[16px] leading-tight'>{title}</h3>
  </div>
);

export default VideoCard;

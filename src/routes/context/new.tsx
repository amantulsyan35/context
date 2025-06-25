import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { DurationInput } from '@/components/duration-input';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';

export const Route = createFileRoute('/context/new')({
  component: NewContext,
});

export function NewContext() {
  const mutateVideo = useMutation(api.mutations.video.createVideo);
  const navigate = useNavigate();
  const form = useForm({
    defaultValues: {
      title: '',
      youtubeLink: '',
      startTime: 0,
      endTime: 0,
    },
    onSubmit: async ({ value }) => {
      const id = await mutateVideo({
        title: value.title,
        link: value.youtubeLink,
        startTime: value.startTime,
        endTime: value.endTime,
      });

      if (id) {
        navigate({
          to: `/context/video/${id}`,
          params: {
            videoId: id,
          },
        });
      }
    },
  });

  return (
    <main className='relative flex justify-center items-center'>
      <section className='h-[25rem] w-full overflow-y-scroll flex  gap-4 flex-wrap justify-center p-4 bg-[#111110]'></section>
      <div className='h-[30rem] cursor-pointer w-[50rem] absolute -bottom-[15rem]  bg-slate-50 rounded-md shadow-md flex flex-col items-center justify-center p-4 gap-8'>
        <h1 className='font-Book text-6xl'>Create Context</h1>
        <label className='w-3/4 flex flex-col gap-[5px] '>
          <p className='text-left font-lora uppercase text-xs tracking-widest'>Title</p>
          <form.Field
            name='title'
            children={(field) => (
              <>
                <Input
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  className='focus-within:outline-none'
                  type='text'
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </>
            )}
          />
        </label>
        <label className='w-3/4 flex flex-col gap-[5px] '>
          <p className='text-left font-lora uppercase text-xs tracking-widest'>Youtube Link</p>
          <form.Field
            name='youtubeLink'
            children={(field) => (
              <>
                <Input
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  className='focus-within:outline-none'
                  type='text'
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </>
            )}
          />
        </label>
        <label className='w-3/4 flex flex-col gap-[5px]'>
          <p className='font-lora uppercase text-xs tracking-widest'>
            Start / End Times (H : M : S)
          </p>
          <div className='flex gap-6 mt-2'>
            {/* Field for startTime */}
            <form.Field
              name='startTime'
              children={(field) => (
                <DurationInput
                  label=''
                  seconds={field.state.value}
                  onChange={(s) => field.handleChange(s)}
                />
              )}
            />

            {/* Field for endTime */}
            <form.Field
              name='endTime'
              children={(field) => (
                <DurationInput
                  label=''
                  seconds={field.state.value}
                  onChange={(s) => field.handleChange(s)}
                />
              )}
            />
          </div>
        </label>
        <Button
          onClick={() => {
            form.handleSubmit();
          }}
        >
          Generate
        </Button>
      </div>
    </main>
  );
}

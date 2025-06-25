import { Input } from './ui/input';

interface DurationInputProps {
  label: string;
  seconds: number;
  onChange: (newSeconds: number) => void;
}

/**
 * A simple H / M / S picker for durations.
 */
export const DurationInput = ({ label, seconds, onChange }: DurationInputProps) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const update = (h: number, m: number, s: number) => {
    onChange(h * 3600 + m * 60 + s);
  };

  return (
    <div className='flex flex-col gap-2 w-full'>
      <span className='text-xs uppercase'>{label}</span>
      <div className='flex items-center justify-start  gap-2'>
        <Input
          type='number'
          min={0}
          value={hours}
          onChange={(e) => update(Number(e.target.value), minutes, secs)}
          className='rounded-md p-2'
          placeholder='HH'
        />
        <span>:</span>
        <Input
          type='number'
          min={0}
          max={59}
          value={minutes}
          onChange={(e) => update(hours, Number(e.target.value), secs)}
          className=' rounded-md p-2'
          placeholder='MM'
        />
        <span>:</span>
        <Input
          type='number'
          min={0}
          max={59}
          value={secs}
          onChange={(e) => update(hours, minutes, Number(e.target.value))}
          className=' rounded-md p-2'
          placeholder='SS'
        />
      </div>
    </div>
  );
};

import { useState, useEffect } from 'react';
import { format } from 'date-fns';

interface LiveClockProps {
  className?: string;
  showSeconds?: boolean;
}

export function LiveClock({ className = '', showSeconds = false }: LiveClockProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const timeFormat = showSeconds ? 'h:mm:ss' : 'h:mm';
  const period = format(time, 'a');

  return (
    <div className={className}>
      <span className="tabular-nums">
        {format(time, timeFormat)}
      </span>
      <span className="text-[0.4em] ml-1 font-normal text-muted-foreground">
        {period}
      </span>
    </div>
  );
}

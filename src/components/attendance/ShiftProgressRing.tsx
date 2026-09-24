import { useMemo } from 'react';

interface ShiftProgressRingProps {
  hoursWorked: number;
  shiftHours?: number;
  size?: number;
  strokeWidth?: number;
}

export function ShiftProgressRing({
  hoursWorked,
  shiftHours = 9,
  size = 180,
  strokeWidth = 12,
}: ShiftProgressRingProps) {
  const { circumference, offset, percentage, displayHours, displayMinutes } = useMemo(() => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const percentage = Math.min((hoursWorked / shiftHours) * 100, 100);
    const offset = circumference - (percentage / 100) * circumference;
    
    const totalMinutes = Math.floor(hoursWorked * 60);
    const displayHours = Math.floor(totalMinutes / 60);
    const displayMinutes = totalMinutes % 60;
    
    return { circumference, offset, percentage, displayHours, displayMinutes };
  }, [hoursWorked, shiftHours, size, strokeWidth]);

  const radius = (size - strokeWidth) / 2;
  const center = size / 2;

  // Determine color based on progress
  const getProgressColor = () => {
    if (percentage >= 100) return 'hsl(var(--success))';
    if (percentage >= 75) return 'hsl(var(--primary))';
    if (percentage >= 50) return 'hsl(var(--warning))';
    return 'hsl(var(--muted-foreground))';
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          className="opacity-30"
        />
        {/* Progress circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={getProgressColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-3xl font-bold tracking-tight">
          {displayHours}h {displayMinutes}m
        </div>
        <div className="text-sm text-muted-foreground">
          of {shiftHours}h shift
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {Math.round(percentage)}% complete
        </div>
      </div>
    </div>
  );
}

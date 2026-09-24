import { User, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DashboardScopeMode } from '@/hooks/useDashboardScope';

interface Props {
  mode: DashboardScopeMode;
  onChange: (mode: DashboardScopeMode) => void;
  className?: string;
}

export function DashboardScopeToggle({ mode, onChange, className }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Dashboard scope"
      className={cn(
        'inline-flex items-center rounded-md border bg-muted/40 p-0.5 text-sm',
        className
      )}
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'personal'}
        onClick={() => onChange('personal')}
        className={cn(
          'flex items-center gap-1.5 rounded px-3 py-1.5 font-medium transition-colors',
          mode === 'personal'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <User className="h-3.5 w-3.5" />
        My work
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'team'}
        onClick={() => onChange('team')}
        className={cn(
          'flex items-center gap-1.5 rounded px-3 py-1.5 font-medium transition-colors',
          mode === 'team'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Users className="h-3.5 w-3.5" />
        My team
      </button>
    </div>
  );
}

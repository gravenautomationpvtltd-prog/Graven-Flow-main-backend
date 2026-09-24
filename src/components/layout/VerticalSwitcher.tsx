import { Check, ChevronsUpDown, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useVertical } from '@/contexts/VerticalContext';

export function VerticalSwitcher() {
  const { verticals, activeVertical, switchVertical, loading } = useVertical();

  if (loading || verticals.length === 0) return null;

  // Hide entirely when there's only one vertical and it's the default
  if (verticals.length === 1) {
    return (
      <Badge variant="outline" className="hidden md:inline-flex gap-1.5 font-normal">
        <Layers className="h-3 w-3" />
        {verticals[0].name}
      </Badge>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 max-w-[200px]">
          <Layers className="h-4 w-4 text-primary shrink-0" />
          <span className="truncate font-medium">
            {activeVertical?.name ?? 'Select vertical'}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Business Vertical</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {verticals.map((v) => (
          <DropdownMenuItem
            key={v.id}
            onClick={() => switchVertical(v.id)}
            className="flex items-center justify-between gap-2"
          >
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate">{v.name}</span>
              <span className="text-xs text-muted-foreground">
                {v.doc_prefix} · {v.code}
                {v.is_default && ' · default'}
              </span>
            </div>
            {v.id === activeVertical?.id && (
              <Check className="h-4 w-4 text-primary shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

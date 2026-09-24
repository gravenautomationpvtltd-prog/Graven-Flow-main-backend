import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Phone, MessageCircle, Mail, CalendarClock, User, StickyNote, Sparkles } from 'lucide-react';
import { useCstEngagements } from '@/hooks/useCstEngagements';
import { formatDistanceToNow, format } from 'date-fns';
import type { CstCustomer } from '@/hooks/useCstCustomers';

interface Props {
  customer: CstCustomer | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const channelIcon: Record<string, any> = {
  call: Phone, whatsapp: MessageCircle, email: Mail,
  meeting: User, note: StickyNote, system: Sparkles,
};

const outcomeColor: Record<string, string> = {
  connected: 'bg-emerald-100 text-emerald-800',
  no_answer: 'bg-zinc-100 text-zinc-700',
  interested: 'bg-blue-100 text-blue-800',
  order_promise: 'bg-violet-100 text-violet-800',
  info_shared: 'bg-sky-100 text-sky-800',
  not_interested: 'bg-amber-100 text-amber-800',
  do_not_contact: 'bg-red-100 text-red-800',
  other: 'bg-zinc-100 text-zinc-700',
};

export function CstReconnectPanel({ customer, open, onOpenChange }: Props) {
  const { data: engagements = [], isLoading } = useCstEngagements(customer?.id ?? null);

  if (!customer) return null;

  const touches30 = engagements.filter(e => Date.now() - new Date(e.created_at).getTime() < 30 * 86400_000).length;
  const promises = engagements.filter(e => e.outcome === 'order_promise').length;
  const upcoming = engagements
    .filter(e => e.next_action_at && new Date(e.next_action_at) > new Date())
    .sort((a, b) => new Date(a.next_action_at!).getTime() - new Date(b.next_action_at!).getTime());

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{customer.company_name}</SheetTitle>
          <SheetDescription>
            {[customer.contact_person, customer.city, customer.state].filter(Boolean).join(' · ') || '—'}
          </SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-3 gap-2 mt-4">
          <Card><CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Touches · 30d</p>
            <p className="text-xl font-semibold">{touches30}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total touches</p>
            <p className="text-xl font-semibold">{engagements.length}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Promises</p>
            <p className="text-xl font-semibold">{promises}</p>
          </CardContent></Card>
        </div>

        {upcoming.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-medium uppercase text-muted-foreground mb-2">Scheduled</p>
            <div className="space-y-2">
              {upcoming.slice(0, 3).map(e => (
                <div key={e.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  <div className="flex-1">
                    <p className="font-medium">{e.next_action_type || 'Follow-up'}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(e.next_action_at!), 'dd MMM, hh:mm a')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6">
          <p className="text-xs font-medium uppercase text-muted-foreground mb-2">Timeline</p>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : engagements.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8 border rounded-md bg-muted/20">
              No touches logged yet.
            </div>
          ) : (
            <ol className="relative border-l border-border ml-3 space-y-4">
              {engagements.map(e => {
                const Icon = channelIcon[e.channel] || StickyNote;
                return (
                  <li key={e.id} className="ml-4">
                    <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-background border">
                      <Icon className="h-3 w-3" />
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium capitalize">{e.channel}</span>
                      {e.outcome && (
                        <Badge variant="secondary" className={outcomeColor[e.outcome]}>
                          {e.outcome.replace(/_/g, ' ')}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    {e.summary && <p className="text-sm mt-1 whitespace-pre-line">{e.summary}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      by {e.user?.full_name || 'Unknown'}
                      {e.next_action_at && ` · next: ${format(new Date(e.next_action_at), 'dd MMM, hh:mm a')}`}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

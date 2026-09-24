import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, MessageCircle, Mail, MapPin, User, Star, CalendarClock, CheckCircle2, StickyNote, Plus, BellOff, History } from 'lucide-react';
import type { CstCustomer } from '@/hooks/useCstCustomers';
import type { EngagementSummary } from '@/hooks/useCstEngagements';
import { useLogEngagement, useToggleCstFlag } from '@/hooks/useCstEngagements';
import { CstLogEngagementDialog } from './CstLogEngagementDialog';
import { RepeatEnquiryDialog } from './RepeatEnquiryDialog';
import { formatDistanceToNowStrict } from 'date-fns';

interface Props {
  customer: CstCustomer & {
    assigned_sales_id?: string | null;
    owner_name?: string | null;
    cst_favourite?: boolean;
    cst_dnc?: boolean;
  };
  summary: EngagementSummary;
  onOpenPanel: (c: CstCustomer) => void;
}

const waLink = (phone: string) =>
  `https://wa.me/${phone.replace(/\D/g, '').replace(/^0+/, '').slice(-10).padStart(12, '91')}`;

export function CstCustomerCard({ customer, summary, onOpenPanel }: Props) {
  const [logOpen, setLogOpen] = useState(false);
  const [defaultChannel, setDefaultChannel] = useState<'call' | 'whatsapp' | 'email' | 'note'>('call');
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const quickLog = useLogEngagement();
  const toggleFlag = useToggleCstFlag();

  const lastAt = summary.last_engagement_at || customer.last_activity_date;
  const silentDays = lastAt ? Math.floor((Date.now() - new Date(lastAt).getTime()) / 86400_000) : null;

  const engagementBadge = (() => {
    if (customer.cst_dnc) return <Badge variant="destructive" className="gap-1"><BellOff className="h-3 w-3" /> DNC</Badge>;
    if (summary.scheduled_callback_at) {
      const due = new Date(summary.scheduled_callback_at);
      const overdue = due < new Date();
      return (
        <Badge className={overdue ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}>
          <CalendarClock className="h-3 w-3 mr-1" />
          {overdue ? 'Overdue' : formatDistanceToNowStrict(due, { addSuffix: true })}
        </Badge>
      );
    }
    if (silentDays !== null && silentDays >= 30) {
      return <Badge className="bg-amber-100 text-amber-800">Silent {silentDays}d</Badge>;
    }
    if (silentDays !== null && silentDays <= 1) {
      return <Badge className="bg-emerald-100 text-emerald-800">Contacted today</Badge>;
    }
    return <Badge variant="outline">Fresh</Badge>;
  })();

  const openLog = (channel: 'call' | 'whatsapp' | 'email' | 'note') => {
    setDefaultChannel(channel);
    setLogOpen(true);
  };

  const markContacted = async () => {
    await quickLog.mutateAsync({
      customer_id: customer.id,
      channel: 'call',
      outcome: 'connected',
      summary: 'Marked as contacted (quick action)',
    });
  };

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <button
                onClick={() => onOpenPanel(customer)}
                className="font-semibold text-left hover:text-primary truncate block"
              >
                {customer.company_name}
              </button>
              {customer.contact_person && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                  <User className="h-3 w-3" /> {customer.contact_person}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              {engagementBadge}
              <button
                onClick={() => toggleFlag.mutate({ customer_id: customer.id, field: 'cst_favourite', value: !customer.cst_favourite })}
                aria-label="Toggle favourite"
              >
                <Star className={`h-4 w-4 ${customer.cst_favourite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
              </button>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-1 text-xs">
            {customer.phone && (
              <a href={`tel:${customer.phone}`} className="flex items-center gap-1.5 text-primary hover:underline">
                <Phone className="h-3 w-3" /> {customer.phone}
              </a>
            )}
            {customer.email && (
              <a href={`mailto:${customer.email}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground truncate">
                <Mail className="h-3 w-3 flex-shrink-0" /> <span className="truncate">{customer.email}</span>
              </a>
            )}
            {(customer.city || customer.state) && (
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-3 w-3" /> {[customer.city, customer.state].filter(Boolean).join(', ')}
              </p>
            )}
            {customer.owner_name && (
              <p className="text-muted-foreground">Sales: <span className="font-medium text-foreground">{customer.owner_name}</span></p>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span title="Touches in last 30 days">
              <History className="h-3 w-3 inline mr-1" />
              {summary.touches_30d} · 30d
            </span>
            {customer.order_count > 0 && (
              <span>{customer.order_count} orders</span>
            )}
            {silentDays !== null && (
              <span>Last: {silentDays}d ago</span>
            )}
          </div>

          {/* Action row 1 */}
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" className="flex-1" onClick={markContacted} disabled={quickLog.isPending}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Contacted
            </Button>
            <Button size="sm" className="flex-1" onClick={() => setEnquiryOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Enquiry
            </Button>
          </div>

          {/* Action row 2 */}
          <div className="grid grid-cols-4 gap-1">
            <Button size="sm" variant="ghost" onClick={() => openLog('call')} title="Log call">
              <Phone className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => openLog('whatsapp')} title="Log WhatsApp" asChild>
              <a href={customer.phone ? waLink(customer.phone) : '#'} target="_blank" rel="noreferrer"
                onClick={(e) => { e.stopPropagation(); }}>
                <MessageCircle className="h-3.5 w-3.5" />
              </a>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => openLog('email')} title="Log email">
              <Mail className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => openLog('note')} title="Add note">
              <StickyNote className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <CstLogEngagementDialog
        open={logOpen}
        onOpenChange={setLogOpen}
        customerId={customer.id}
        customerName={customer.company_name}
        defaultChannel={defaultChannel}
      />

      <RepeatEnquiryDialog
        open={enquiryOpen}
        onOpenChange={setEnquiryOpen}
        customerId={customer.id}
        customerName={customer.company_name}
        assignedSalesId={customer.assigned_sales_id ?? null}
      />
    </>
  );
}

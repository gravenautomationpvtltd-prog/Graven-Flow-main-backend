import { useState } from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Package,
  Receipt,
  CreditCard,
  Search,
  ClipboardList,
  Star,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { SupplierJourneyEvent } from '@/hooks/useSupplierNetworkDetail';

interface SupplierJourneyTimelineProps {
  timeline: SupplierJourneyEvent[];
  isLoading?: boolean;
}

const eventConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  application: { icon: FileText, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  review: { icon: Clock, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  approval: { icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-100' },
  rejection: { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100' },
  rfq: { icon: ClipboardList, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  quotation: { icon: Receipt, color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  po: { icon: Package, color: 'text-teal-600', bgColor: 'bg-teal-100' },
  grn: { icon: Package, color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
  payment: { icon: CreditCard, color: 'text-green-600', bgColor: 'bg-green-100' },
  suspension: { icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-100' },
  reactivation: { icon: RefreshCw, color: 'text-green-600', bgColor: 'bg-green-100' },
  rating: { icon: Star, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
};

export function SupplierJourneyTimeline({ timeline, isLoading }: SupplierJourneyTimelineProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [showAll, setShowAll] = useState(false);

  const filteredTimeline = timeline.filter((event) => {
    const matchesSearch = searchQuery === '' || 
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = eventFilter === 'all' || event.event_type === eventFilter;
    
    return matchesSearch && matchesFilter;
  });

  const displayedTimeline = showAll ? filteredTimeline : filteredTimeline.slice(0, 10);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Journey Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-muted" />
                <div className="flex-1">
                  <div className="h-4 bg-muted rounded w-48 mb-2" />
                  <div className="h-3 bg-muted rounded w-64" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Journey Timeline</CardTitle>
          <div className="flex items-center gap-3">
            <div className="relative w-48">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="application">Applications</SelectItem>
                <SelectItem value="review">Reviews</SelectItem>
                <SelectItem value="approval">Approvals</SelectItem>
                <SelectItem value="rfq">RFQs</SelectItem>
                <SelectItem value="quotation">Quotations</SelectItem>
                <SelectItem value="po">Purchase Orders</SelectItem>
                <SelectItem value="grn">GRNs</SelectItem>
                <SelectItem value="payment">Payments</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredTimeline.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No events found
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />
            
            <div className="space-y-6">
              {displayedTimeline.map((event, index) => {
                const config = eventConfig[event.event_type] || eventConfig.application;
                const Icon = config.icon;

                return (
                  <div key={event.id} className="relative flex gap-4 pl-2">
                    {/* Icon */}
                    <div className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full ${config.bgColor} flex items-center justify-center`}>
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm">{event.title}</p>
                          {event.description && (
                            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                              {event.description}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {format(new Date(event.timestamp), 'MMM dd, yyyy')}
                        </Badge>
                      </div>
                      {event.metadata?.changedBy && (
                        <p className="text-xs text-muted-foreground mt-1">
                          by {String(event.metadata.changedBy)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredTimeline.length > 10 && (
              <div className="mt-6 text-center">
                <Button 
                  variant="outline" 
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? 'Show Less' : `Show All (${filteredTimeline.length} events)`}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

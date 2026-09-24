import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageCircle, Mail, Target, History, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCustomerOutreachHistoryByCustomer, useMarkOutreachResponse } from '@/hooks/useCustomerOutreach';
import { format } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CustomerOutreachSectionProps {
  customerId: string;
}

export function CustomerOutreachSection({ customerId }: CustomerOutreachSectionProps) {
  const { data: outreachHistory, isLoading } = useCustomerOutreachHistoryByCustomer(customerId);
  const markResponse = useMarkOutreachResponse();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Enquiry History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy');
  };

  const formatTime = (dateString: string) => {
    return format(new Date(dateString), 'h:mm a');
  };

  const handleMarkResponse = (outreachId: string, channel: 'email' | 'whatsapp') => {
    markResponse.mutate({ outreachId, channel });
  };

  const hasAnyResponse = (entry: any) => {
    return entry.whatsapp_response_at || entry.email_response_at;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Enquiry History {outreachHistory && outreachHistory.length > 0 && `(${outreachHistory.length})`}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!outreachHistory || outreachHistory.length === 0 ? (
          <p className="text-muted-foreground text-center py-6">
            No outreach history for this customer yet.
          </p>
        ) : (
          <div className="space-y-3">
            {outreachHistory.map((entry) => (
              <div key={entry.id} className="border border-border rounded-lg p-4">
                <div className="font-medium text-sm text-muted-foreground mb-2">
                  📅 {formatDate(entry.campaign_date)}
                </div>
                
                <div className="space-y-2">
                  {entry.whatsapp_sent_at && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <MessageCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">WhatsApp sent at {formatTime(entry.whatsapp_sent_at)}</span>
                      {entry.whatsapp_response_at ? (
                        <Badge 
                          variant="default"
                          className="bg-green-100 text-green-800 hover:bg-green-100"
                        >
                          ✓ Responded
                        </Badge>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Badge 
                              variant="secondary"
                              className="cursor-pointer hover:bg-secondary/80 flex items-center gap-1"
                            >
                              ○ No Response
                              <ChevronDown className="h-3 w-3" />
                            </Badge>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem 
                              onClick={() => handleMarkResponse(entry.id, 'whatsapp')}
                              className="cursor-pointer"
                            >
                              <MessageCircle className="h-4 w-4 mr-2 text-green-600" />
                              Mark WhatsApp Response
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleMarkResponse(entry.id, 'email')}
                              className="cursor-pointer"
                            >
                              <Mail className="h-4 w-4 mr-2 text-blue-600" />
                              Mark Email Response
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  )}
                  
                  {entry.email_sent_at && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Mail className="h-4 w-4 text-blue-600" />
                      <span className="text-sm">Email sent at {formatTime(entry.email_sent_at)}</span>
                      {entry.email_response_at ? (
                        <Badge 
                          variant="default"
                          className="bg-blue-100 text-blue-800 hover:bg-blue-100"
                        >
                          ✓ Responded
                        </Badge>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Badge 
                              variant="secondary"
                              className="cursor-pointer hover:bg-secondary/80 flex items-center gap-1"
                            >
                              ○ No Response
                              <ChevronDown className="h-3 w-3" />
                            </Badge>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem 
                              onClick={() => handleMarkResponse(entry.id, 'whatsapp')}
                              className="cursor-pointer"
                            >
                              <MessageCircle className="h-4 w-4 mr-2 text-green-600" />
                              Mark WhatsApp Response
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleMarkResponse(entry.id, 'email')}
                              className="cursor-pointer"
                            >
                              <Mail className="h-4 w-4 mr-2 text-blue-600" />
                              Mark Email Response
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  )}
                  
                  {entry.lead && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
                      <Target className="h-4 w-4 text-primary" />
                      <span className="text-sm">Lead Generated:</span>
                      <Link 
                        to={`/leads/${entry.lead.id}`}
                        className="text-sm text-primary hover:underline font-medium"
                      >
                        {entry.lead.title} →
                      </Link>
                    </div>
                  )}

                  {entry.error_message && (
                    <div className="text-sm text-destructive mt-2">
                      Error: {entry.error_message}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

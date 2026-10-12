import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { MoreHorizontal, Pencil, Trash2, Eye, Phone, Mail, Star } from 'lucide-react';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { getSegmentConfig, SEGMENT_OPTIONS } from '@/lib/segment-config';
import { useUpdateCustomerSegment } from '@/hooks/useCROAssignments';
import { useNavigate } from 'react-router-dom';
import { CopyableText, CopyablePhone, CopyableEmail } from '@/components/shared/CopyableText';
import { Skeleton } from '@/components/ui/skeleton';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { useEnquiryTemplate } from '@/hooks/useCustomerOutreach';
import { useTrackOutreach } from '@/hooks/useTrackOutreach';
import { useCustomerOutreachDates, getOutreachStatus } from '@/hooks/useCustomerOutreachDates';
import { toast } from 'sonner';
import { SendEnquiryEmailDialog } from './SendEnquiryEmailDialog';
import type { Database } from '@/integrations/supabase/types';

type Customer = Database['public']['Tables']['customers']['Row'];

interface CustomerListTableProps {
  customers: Customer[] | undefined;
  isLoading: boolean;
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
  totalCount?: number;
  currentPage?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
  onToggleSelectAll?: () => void;
  isAllSelected?: boolean;
  isSomeSelected?: boolean;
}

export function CustomerListTable({ 
  customers, 
  isLoading, 
  onEdit, 
  onDelete,
  totalCount = 0,
  currentPage = 0,
  pageSize = 50,
  onPageChange,
  onPageSizeChange,
  selectedIds,
  onToggleSelection,
  onToggleSelectAll,
  isAllSelected,
  isSomeSelected,
}: CustomerListTableProps) {
  const navigate = useNavigate();
  const { data: whatsappTemplate } = useEnquiryTemplate('whatsapp');
  const [emailDialogCustomer, setEmailDialogCustomer] = useState<Customer | null>(null);
  const trackOutreach = useTrackOutreach();
  const updateSegment = useUpdateCustomerSegment();

  const customerIds = useMemo(() => (customers || []).map(c => c.id), [customers]);
  const { data: outreachDates } = useCustomerOutreachDates(customerIds);

  const replaceTemplatePlaceholders = (text: string, customer: Customer) => {
    const customerName = customer.contact_person || customer.company_name;
    return text.replace(/\{\{customer_name\}\}/g, customerName);
  };

  const handleWhatsAppEnquiry = async (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation();
    if (!customer.phone) {
      toast.error('No phone number available');
      return;
    }

    try {
      await trackOutreach.mutateAsync({ customerId: customer.id, channel: 'whatsapp' });
    } catch (error) {
      console.error('Failed to track WhatsApp outreach:', error);
    }

    const phone = customer.phone.replace(/\D/g, '');
    const phoneWithCountry = phone.startsWith('91') ? phone : `91${phone.slice(-10)}`;
    
    let message = 'Hello! We wanted to check if you have any enquiries for automation products.';
    if (whatsappTemplate?.body) {
      message = replaceTemplatePlaceholders(whatsappTemplate.body, customer);
    }

    const whatsappUrl = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleEmailEnquiry = (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation();
    if (!customer.email) {
      toast.error('No email address available');
      return;
    }
    setEmailDialogCustomer(customer);
  };

  const hasSelection = !!selectedIds && !!onToggleSelection;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!customers || customers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Phone className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">No customers yet</h3>
        <p className="text-muted-foreground mt-1">Add your first customer to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {hasSelection && (
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) {
                        (el as any).indeterminate = isSomeSelected;
                      }
                    }}
                    onCheckedChange={() => onToggleSelectAll?.()}
                  />
                </TableHead>
              )}
              <TableHead>Company</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Segment</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Last Contacted</TableHead>
              <TableHead>Quick Actions</TableHead>
              <TableHead className="w-[130px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => {
              const outreach = getOutreachStatus(outreachDates?.get(customer.id));
              const isSelected = selectedIds?.has(customer.id) ?? false;
              
              return (
                <TableRow 
                  key={customer.id} 
                  className={`hover:bg-muted/40 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}
                >
                  {hasSelection && (
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleSelection?.(customer.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <CopyableText
                      text={customer.company_name}
                      label="company name"
                      onClickText={() => navigate(`/customers/${customer.id}`)}
                      textClassName="font-medium text-foreground"
                    />
                    {customer.email && (
                      <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Mail className="h-3 w-3 shrink-0" />
                        <CopyableEmail email={customer.email} />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <CopyableText text={customer.contact_person} label="contact person" />
                  </TableCell>
                  <TableCell>
                    {customer.phone ? (
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                        <CopyablePhone phone={customer.phone} />
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <CopyableText
                      text={customer.city && customer.state 
                        ? `${customer.city}, ${customer.state}`
                        : customer.city || customer.state || null
                      }
                      label="location"
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant={customer.is_b2b ? 'default' : 'secondary'}>
                      {customer.is_b2b ? 'B2B' : 'B2C'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const seg = getSegmentConfig(customer.segment);
                      return (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${seg.badgeClass}`}>
                          {seg.label}
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {(customer as any).assigned_sales?.full_name || 'Unassigned'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`text-sm font-medium ${outreach.color}`}>
                      {outreach.label}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 bg-green-50 hover:bg-green-100 text-green-600 dark:bg-green-950 dark:hover:bg-green-900 dark:text-green-400"
                            onClick={(e) => handleWhatsAppEnquiry(e, customer)}
                            disabled={!customer.phone}
                          >
                            <WhatsAppIcon className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Send WhatsApp Enquiry</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 hover:bg-blue-50 text-blue-600 dark:hover:bg-blue-950 dark:text-blue-400"
                            onClick={(e) => handleEmailEnquiry(e, customer)}
                            disabled={!customer.email}
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Send Email Enquiry</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/customers/${customer.id}`); }}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(customer); }}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => { e.stopPropagation(); onDelete(customer); }}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger onClick={(e) => e.stopPropagation()}>
                            <Star className="mr-2 h-4 w-4" />
                            Change Segment
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            {SEGMENT_OPTIONS.map((seg) => {
                              const conf = getSegmentConfig(seg);
                              return (
                                <DropdownMenuItem
                                  key={seg}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateSegment.mutate({ customerId: customer.id, segment: seg });
                                  }}
                                  className={customer.segment === seg ? 'font-bold' : ''}
                                >
                                  <span className={`mr-2 inline-block h-2 w-2 rounded-full ${conf.color.split(' ')[0]}`} />
                                  {conf.label}
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <SendEnquiryEmailDialog
        customer={emailDialogCustomer}
        open={!!emailDialogCustomer}
        onOpenChange={(open) => !open && setEmailDialogCustomer(null)}
      />

      {onPageChange && onPageSizeChange && (
        <PaginationControls
          currentPage={currentPage}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
}

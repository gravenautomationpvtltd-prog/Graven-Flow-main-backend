import { useState } from 'react';
import { MoreVertical, Trophy, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LeadStatusBadge } from './LeadStatusBadge';
import { LeadSourceBadge } from './LeadSourceBadge';
import { EditLeadDialog } from './EditLeadDialog';
import { WinLossReasonDialog } from './WinLossReasonDialog';
import { useUpdateLead, useDeleteLead } from '@/hooks/useLeads';
import { useCreateActivity } from '@/hooks/useActivities';
import type { LeadWithCustomer } from '@/hooks/useLeads';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { DoubleConfirmDeleteDialog } from '@/components/ui/double-confirm-delete-dialog';
import { useTranslation } from '@/lib/i18n';

type LeadStatus = Database['public']['Enums']['lead_status'];
const leadStatuses: LeadStatus[] = ['new', 'contacted', 'enquiry', 'no_enquiry', 'engaged', 'quoted', 'negotiation', 'won', 'lost'];

interface LeadHeaderProps {
  lead: LeadWithCustomer;
}

export function LeadHeader({ lead }: LeadHeaderProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const createActivity = useCreateActivity();
  const { isAdmin, user } = useAuth();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [wonDialogOpen, setWonDialogOpen] = useState(false);
  const [lostDialogOpen, setLostDialogOpen] = useState(false);

  const handleStatusChange = async (status: string) => {
    // If changing to won/lost, show the reason dialog instead
    if (status === 'won') {
      setWonDialogOpen(true);
      return;
    }
    if (status === 'lost') {
      setLostDialogOpen(true);
      return;
    }

    await updateLead.mutateAsync({ id: lead.id, status: status as LeadStatus });
  };

  const handleMarkWon = async (reason: string, notes?: string) => {
    await updateLead.mutateAsync({
      id: lead.id,
      status: 'won',
      won_at: new Date().toISOString(),
      won_reason: reason,
      won_reason_notes: reason === 'other' ? notes : null,
    });
    await createActivity.mutateAsync({
      lead_id: lead.id,
      activity_type: 'status_change',
      description: `Lead marked as Won - Reason: ${reason}${notes ? ` (${notes})` : ''}`,
    });
    toast.success('Lead marked as won!');
    setWonDialogOpen(false);
  };

  const handleMarkLost = async (reason: string, notes?: string) => {
    await updateLead.mutateAsync({
      id: lead.id,
      status: 'lost',
      lost_at: new Date().toISOString(),
      lost_reason: reason,
      lost_reason_notes: reason === 'other' ? notes : null,
    });
    await createActivity.mutateAsync({
      lead_id: lead.id,
      activity_type: 'status_change',
      description: `Lead marked as Lost - Reason: ${reason}${notes ? ` (${notes})` : ''}`,
    });
    toast.info('Lead marked as lost');
    setLostDialogOpen(false);
  };

  const handleDelete = async () => {
    await deleteLead.mutateAsync(lead.id);
    navigate('/leads');
  };

  const handleDuplicate = () => {
    toast.info('Duplicate coming soon');
  };

  const sourceLabel = lead.source.charAt(0).toUpperCase() + lead.source.slice(1);
  const ownerName = lead.assigned_user?.full_name || user?.user_metadata?.full_name || 'Unassigned';

  return (
    <>
      {/* Header Actions */}
      <div className="flex items-center justify-end gap-2 pb-2 border-b border-border/50">
          <Select value={lead.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[130px] h-8 text-sm">
              <SelectValue>
                <LeadStatusBadge status={lead.status} />
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {leadStatuses.map((status) => (
                <SelectItem key={status} value={status}>
                  <LeadStatusBadge status={status} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setLostDialogOpen(true)}
            disabled={updateLead.isPending || lead.status === 'lost'}
            className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
          >
            <XCircle className="h-4 w-4 mr-1.5" />
            {t('leads.mark_lost', 'Mark Lost')}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setWonDialogOpen(true)}
            disabled={updateLead.isPending || lead.status === 'won'}
            className="text-green-600 border-green-600/30 hover:bg-green-500/10 hover:text-green-600"
          >
            <Trophy className="h-4 w-4 mr-1.5" />
            {t('leads.mark_won', 'Mark Won')}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
                {t('leads.edit_lead', 'Edit Lead')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDuplicate}>
                {t('leads.duplicate_lead', 'Duplicate Lead')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setDeleteDialogOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                {t('leads.delete_lead', 'Delete Lead')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
      </div>

      {/* Title Section */}
      <div className="pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-display font-bold truncate">{lead.title}</h1>
              <LeadSourceBadge source={lead.source} />
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>
                {t('leads.created', 'Created')} {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
              </span>
              <span className="text-border">•</span>
              <span>{t('leads.owner', 'Owner')}: {ownerName}</span>
              <span className="text-border">•</span>
              <span className="font-mono text-xs">#{lead.id.slice(0, 8).toUpperCase()}</span>
            </div>
          </div>
        </div>
      </div>

      <EditLeadDialog
        lead={lead}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />

      <WinLossReasonDialog
        open={wonDialogOpen}
        onOpenChange={setWonDialogOpen}
        type="won"
        onConfirm={handleMarkWon}
        isLoading={updateLead.isPending}
      />

      <WinLossReasonDialog
        open={lostDialogOpen}
        onOpenChange={setLostDialogOpen}
        type="lost"
        onConfirm={handleMarkLost}
        isLoading={updateLead.isPending}
      />

      <DoubleConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title={t('leads.delete_lead', 'Delete Lead')}
        description={t('leads.delete_confirm', 'This will permanently delete this lead and all associated activities, quotations, and orders.')}
        itemDetails={(
          <>
            <p><strong>Lead:</strong> {lead.title}</p>
            <p><strong>Customer:</strong> {lead.customer?.company_name || '-'}</p>
            <p><strong>Source:</strong> {sourceLabel}</p>
          </>
        )}
        isLoading={deleteLead.isPending}
      />
    </>
  );
}
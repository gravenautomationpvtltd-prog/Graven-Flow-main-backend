import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, CheckCircle, Copy, Trash2, RefreshCw, Shield } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DuplicateGroup {
  source: string;
  source_reference: string;
  count: number;
  lead_ids: string[];
  customer_name: string;
  created_dates: string[];
}

interface DuplicateStats {
  totalDuplicateGroups: number;
  totalDuplicateLeads: number;
  bySource: Record<string, number>;
  duplicateGroups: DuplicateGroup[];
}

export function DuplicateLeadsWidget() {
  const queryClient = useQueryClient();
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['duplicate-leads-stats'],
    queryFn: async (): Promise<DuplicateStats> => {
      // Find leads with duplicate source_reference (same source + same reference)
      const { data: leads, error } = await supabase
        .from('leads')
        .select(`
          id,
          source,
          source_reference,
          created_at,
          customer:customers(company_name)
        `)
        .not('source_reference', 'is', null)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group by source + source_reference
      const groups = new Map<string, DuplicateGroup>();
      
      for (const lead of leads || []) {
        const key = `${lead.source}:${lead.source_reference}`;
        
        if (groups.has(key)) {
          const group = groups.get(key)!;
          group.count++;
          group.lead_ids.push(lead.id);
          group.created_dates.push(lead.created_at);
        } else {
          groups.set(key, {
            source: lead.source,
            source_reference: lead.source_reference || '',
            count: 1,
            lead_ids: [lead.id],
            customer_name: (lead.customer as any)?.company_name || 'Unknown',
            created_dates: [lead.created_at],
          });
        }
      }

      // Filter to only groups with duplicates
      const duplicateGroups = Array.from(groups.values()).filter(g => g.count > 1);
      
      // Calculate stats by source
      const bySource: Record<string, number> = {};
      let totalDuplicateLeads = 0;
      
      for (const group of duplicateGroups) {
        bySource[group.source] = (bySource[group.source] || 0) + (group.count - 1);
        totalDuplicateLeads += group.count - 1; // Extra copies beyond the original
      }

      return {
        totalDuplicateGroups: duplicateGroups.length,
        totalDuplicateLeads,
        bySource,
        duplicateGroups: duplicateGroups.slice(0, 10), // Top 10 for display
      };
    },
    // Duplicate cleanup is administrative, not live operational data. Avoid a
    // full leads-table scan every minute in every manager's open browser tab.
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const cleanupMutation = useMutation({
    mutationFn: async () => {
      setIsCleaningUp(true);
      
      // Get all duplicate leads (keeping oldest)
      const { data: leads, error: fetchError } = await supabase
        .from('leads')
        .select('id, source, source_reference, created_at')
        .not('source_reference', 'is', null)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;

      // Group and find duplicates to delete
      const seen = new Map<string, string>(); // key -> oldest lead id
      const toDelete: string[] = [];

      for (const lead of leads || []) {
        const key = `${lead.source}:${lead.source_reference}`;
        
        if (seen.has(key)) {
          toDelete.push(lead.id); // This is a duplicate
        } else {
          seen.set(key, lead.id); // First occurrence, keep it
        }
      }

      if (toDelete.length === 0) {
        return { deleted: 0 };
      }

      // Delete related records first (in order of dependencies)
      // 1. Delete escalation_logs
      await supabase.from('escalation_logs').delete().in('lead_id', toDelete);
      
      // 2. Delete activities
      await supabase.from('activities').delete().in('lead_id', toDelete);
      
      // 3. Delete enquiry_items
      await supabase.from('enquiry_items').delete().in('lead_id', toDelete);
      
      // 4. Delete tasks
      await supabase.from('tasks').delete().in('lead_id', toDelete);
      
      // 5. Delete customer_outreach
      await supabase.from('customer_outreach').delete().in('lead_id', toDelete);
      
      // 6. Delete quotations (this may cascade)
      await supabase.from('quotations').delete().in('lead_id', toDelete);
      
      // 7. Delete dispatches
      await supabase.from('dispatches').delete().in('lead_id', toDelete);
      
      // 8. Finally delete the duplicate leads
      const { error: deleteError } = await supabase
        .from('leads')
        .delete()
        .in('id', toDelete);

      if (deleteError) throw deleteError;

      return { deleted: toDelete.length };
    },
    onSuccess: (result) => {
      toast.success(`Cleaned up ${result.deleted} duplicate leads`);
      queryClient.invalidateQueries({ queryKey: ['duplicate-leads-stats'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setShowCleanupDialog(false);
    },
    onError: (error) => {
      console.error('Cleanup error:', error);
      toast.error('Failed to clean up duplicates');
    },
    onSettled: () => {
      setIsCleaningUp(false);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const hasDuplicates = (stats?.totalDuplicateLeads ?? 0) > 0;

  return (
    <>
      <Card className={hasDuplicates ? 'border-warning/50 bg-warning/5' : 'border-success/50 bg-success/5'}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-lg ${hasDuplicates ? 'bg-warning/10' : 'bg-success/10'}`}>
                {hasDuplicates ? (
                  <Copy className="h-5 w-5 text-warning" />
                ) : (
                  <Shield className="h-5 w-5 text-success" />
                )}
              </div>
              <div>
                <CardTitle className="text-lg">Lead Duplicate Monitor</CardTitle>
                <CardDescription>
                  {hasDuplicates 
                    ? 'Duplicate leads detected in your system' 
                    : 'No duplicate leads detected'}
                </CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              className="h-8 w-8"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasDuplicates ? (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background rounded-lg p-3 border">
                  <div className="text-2xl font-bold text-warning">{stats?.totalDuplicateLeads}</div>
                  <div className="text-xs text-muted-foreground">Duplicate Leads</div>
                </div>
                <div className="bg-background rounded-lg p-3 border">
                  <div className="text-2xl font-bold">{stats?.totalDuplicateGroups}</div>
                  <div className="text-xs text-muted-foreground">Affected Groups</div>
                </div>
              </div>

              {/* By Source Breakdown */}
              {stats?.bySource && Object.keys(stats.bySource).length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">By Source</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(stats.bySource).map(([source, count]) => (
                      <Badge key={source} variant="secondary" className="text-xs">
                        {source}: {count}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Sample Duplicates */}
              {stats?.duplicateGroups && stats.duplicateGroups.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Recent Duplicates</div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {stats.duplicateGroups.slice(0, 5).map((group, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs bg-background rounded p-2 border">
                        <span className="truncate max-w-[60%]">{group.customer_name}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{group.source}</Badge>
                          <Badge variant="destructive" className="text-xs">{group.count}x</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cleanup Button */}
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => setShowCleanupDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clean Up Duplicates
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-background rounded-lg border border-success/30">
              <CheckCircle className="h-8 w-8 text-success" />
              <div>
                <div className="font-medium text-success">All Clear!</div>
                <div className="text-sm text-muted-foreground">
                  Database is protected by unique constraint on source + source_reference
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cleanup Confirmation Dialog */}
      <AlertDialog open={showCleanupDialog} onOpenChange={setShowCleanupDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Clean Up Duplicate Leads
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This will permanently delete <strong>{stats?.totalDuplicateLeads} duplicate leads</strong> and their associated data (activities, tasks, quotations, etc.).
              </p>
              <p>
                The <strong>oldest lead</strong> in each duplicate group will be preserved.
              </p>
              <p className="text-warning font-medium">
                This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCleaningUp}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                cleanupMutation.mutate();
              }}
              disabled={isCleaningUp}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCleaningUp ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Cleaning...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Duplicates
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

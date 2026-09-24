import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProcurementUserStats {
  userId: string;
  userName: string;
  priceResolutions: number;
  avgResolutionTimeHours: number;
  productsUpdated: number;
  posCreated: number;
  totalPoValue: number;
  grnsProcessed: number;
}

interface ProcurementPerformanceData {
  teamStats: ProcurementUserStats[];
  topPerformer: ProcurementUserStats | null;
  teamTotals: {
    totalResolutions: number;
    totalProductsUpdated: number;
    totalPosCreated: number;
    totalPoValue: number;
    totalGrns: number;
    avgResolutionTime: number;
  };
}

export function useProcurementPerformance(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['procurement-performance', startDate, endDate],
    queryFn: async (): Promise<ProcurementPerformanceData> => {
      // First, fetch ALL active profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, is_active')
        .eq('is_active', true);

      if (profilesError) throw profilesError;

      // Fetch user roles separately to avoid deep type inference
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Build a map of user_id -> roles
      const userRoleMap: Record<string, string[]> = {};
      userRoles?.forEach((ur: any) => {
        if (!userRoleMap[ur.user_id]) userRoleMap[ur.user_id] = [];
        userRoleMap[ur.user_id].push(ur.role);
      });

      // Filter to users with at least one procurement-related role
      const relevantRoles = ['procurement', 'warehouse', 'manager', 'coo', 'super_admin'];
      const teamMembers = profiles?.filter((p: any) => {
        const roles = userRoleMap[p.id] || [];
        return roles.some(r => relevantRoles.includes(r));
      }) || [];

      // Initialize stats map with ALL team members
      const userStatsMap: Record<string, ProcurementUserStats> = {};
      
      teamMembers.forEach((member: any) => {
        if (!member.id) return;
        userStatsMap[member.id] = {
          userId: member.id,
          userName: member.full_name || 'Unknown',
          priceResolutions: 0,
          avgResolutionTimeHours: 0,
          productsUpdated: 0,
          posCreated: 0,
          totalPoValue: 0,
          grnsProcessed: 0,
        };
      });

      // Fetch price requests resolved in period
      const { data: priceRequests, error: prError } = await supabase
        .from('price_requests')
        .select(`
          id,
          resolved_by,
          requested_at,
          resolved_at,
          resolver:profiles!price_requests_resolved_by_fkey(id, full_name)
        `)
        .not('resolved_at', 'is', null)
        .gte('resolved_at', startDate)
        .lte('resolved_at', endDate);

      if (prError) throw prError;

      // Fetch products updated in period
      const { data: products, error: prodError } = await supabase
        .from('products')
        .select(`
          id,
          price_updated_by,
          price_updated_at,
          updater:profiles!products_price_updated_by_fkey(id, full_name)
        `)
        .not('price_updated_at', 'is', null)
        .gte('price_updated_at', startDate)
        .lte('price_updated_at', endDate);

      if (prodError) throw prodError;

      // Fetch purchase orders created in period
      const { data: purchaseOrders, error: poError } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          created_by,
          grand_total,
          created_at,
          creator:profiles!purchase_orders_created_by_fkey(id, full_name)
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (poError) throw poError;

      // Fetch GRNs processed in period
      const { data: grns, error: grnError } = await supabase
        .from('goods_receipt_notes')
        .select(`
          id,
          received_by,
          created_at,
          receiver:profiles!goods_receipt_notes_received_by_fkey(id, full_name)
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (grnError) throw grnError;

      // Process price resolutions
      priceRequests?.forEach((pr: any) => {
        if (!pr.resolved_by) return;
        const userId = pr.resolved_by;
        
        // Add user if not in team members list (edge case)
        if (!userStatsMap[userId]) {
          userStatsMap[userId] = {
            userId,
            userName: pr.resolver?.full_name || 'Unknown',
            priceResolutions: 0,
            avgResolutionTimeHours: 0,
            productsUpdated: 0,
            posCreated: 0,
            totalPoValue: 0,
            grnsProcessed: 0,
          };
        }
        userStatsMap[userId].priceResolutions += 1;

        // Calculate resolution time
        if (pr.requested_at && pr.resolved_at) {
          const requestedAt = new Date(pr.requested_at).getTime();
          const resolvedAt = new Date(pr.resolved_at).getTime();
          const hours = (resolvedAt - requestedAt) / (1000 * 60 * 60);
          const current = userStatsMap[userId];
          current.avgResolutionTimeHours = 
            ((current.avgResolutionTimeHours * (current.priceResolutions - 1)) + hours) / 
            current.priceResolutions;
        }
      });

      // Process products updated
      products?.forEach((prod: any) => {
        if (!prod.price_updated_by) return;
        const userId = prod.price_updated_by;
        if (!userStatsMap[userId]) {
          userStatsMap[userId] = {
            userId,
            userName: prod.updater?.full_name || 'Unknown',
            priceResolutions: 0,
            avgResolutionTimeHours: 0,
            productsUpdated: 0,
            posCreated: 0,
            totalPoValue: 0,
            grnsProcessed: 0,
          };
        }
        userStatsMap[userId].productsUpdated += 1;
      });

      // Process POs
      purchaseOrders?.forEach((po: any) => {
        if (!po.created_by) return;
        const userId = po.created_by;
        if (!userStatsMap[userId]) {
          userStatsMap[userId] = {
            userId,
            userName: po.creator?.full_name || 'Unknown',
            priceResolutions: 0,
            avgResolutionTimeHours: 0,
            productsUpdated: 0,
            posCreated: 0,
            totalPoValue: 0,
            grnsProcessed: 0,
          };
        }
        userStatsMap[userId].posCreated += 1;
        userStatsMap[userId].totalPoValue += Number(po.grand_total) || 0;
      });

      // Process GRNs
      grns?.forEach((grn: any) => {
        if (!grn.received_by) return;
        const userId = grn.received_by;
        if (!userStatsMap[userId]) {
          userStatsMap[userId] = {
            userId,
            userName: grn.receiver?.full_name || 'Unknown',
            priceResolutions: 0,
            avgResolutionTimeHours: 0,
            productsUpdated: 0,
            posCreated: 0,
            totalPoValue: 0,
            grnsProcessed: 0,
          };
        }
        userStatsMap[userId].grnsProcessed += 1;
      });

      // Sort by composite score (price resolutions weighted higher)
      const teamStats = Object.values(userStatsMap)
        .sort((a, b) => {
          const scoreA = a.priceResolutions * 3 + a.productsUpdated * 2 + a.posCreated * 2 + a.grnsProcessed;
          const scoreB = b.priceResolutions * 3 + b.productsUpdated * 2 + b.posCreated * 2 + b.grnsProcessed;
          return scoreB - scoreA;
        });

      // Calculate team totals
      const teamTotals = teamStats.reduce(
        (acc, user) => ({
          totalResolutions: acc.totalResolutions + user.priceResolutions,
          totalProductsUpdated: acc.totalProductsUpdated + user.productsUpdated,
          totalPosCreated: acc.totalPosCreated + user.posCreated,
          totalPoValue: acc.totalPoValue + user.totalPoValue,
          totalGrns: acc.totalGrns + user.grnsProcessed,
          avgResolutionTime: 0,
        }),
        { totalResolutions: 0, totalProductsUpdated: 0, totalPosCreated: 0, totalPoValue: 0, totalGrns: 0, avgResolutionTime: 0 }
      );

      // Calculate overall avg resolution time
      if (teamStats.length > 0) {
        const totalWithResolutions = teamStats.filter(u => u.priceResolutions > 0);
        if (totalWithResolutions.length > 0) {
          teamTotals.avgResolutionTime = 
            totalWithResolutions.reduce((sum, u) => sum + u.avgResolutionTimeHours * u.priceResolutions, 0) /
            teamTotals.totalResolutions;
        }
      }

      return {
        teamStats,
        topPerformer: teamStats.length > 0 ? teamStats[0] : null,
        teamTotals,
      };
    },
  });
}

export function useProcurementTargetAnalysis(year: number, month: number) {
  const startOfMonth = new Date(year, month - 1, 1).toISOString();
  const endOfMonth = new Date(year, month, 0, 23, 59, 59).toISOString();

  return useQuery({
    queryKey: ['procurement-target-analysis', year, month],
    queryFn: async () => {
      const { data: targets, error: targetsError } = await supabase
        .from('procurement_targets')
        .select('*, profiles:profiles!procurement_targets_user_id_fkey(full_name)')
        .eq('year', year)
        .eq('month', month)
        .eq('target_type', 'monthly');

      if (targetsError) throw targetsError;

      const { data: priceRequests } = await supabase
        .from('price_requests')
        .select('resolved_by')
        .not('resolved_at', 'is', null)
        .gte('resolved_at', startOfMonth)
        .lte('resolved_at', endOfMonth);

      const { data: products } = await supabase
        .from('products')
        .select('price_updated_by')
        .not('price_updated_at', 'is', null)
        .gte('price_updated_at', startOfMonth)
        .lte('price_updated_at', endOfMonth);

      const { data: purchaseOrders } = await supabase
        .from('purchase_orders')
        .select('created_by, grand_total')
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth);

      const actualsByUser: Record<string, Record<string, number>> = {};

      priceRequests?.forEach((pr: any) => {
        if (!pr.resolved_by) return;
        if (!actualsByUser[pr.resolved_by]) actualsByUser[pr.resolved_by] = {};
        actualsByUser[pr.resolved_by].price_resolutions = 
          (actualsByUser[pr.resolved_by].price_resolutions || 0) + 1;
      });

      products?.forEach((p: any) => {
        if (!p.price_updated_by) return;
        if (!actualsByUser[p.price_updated_by]) actualsByUser[p.price_updated_by] = {};
        actualsByUser[p.price_updated_by].products_added = 
          (actualsByUser[p.price_updated_by].products_added || 0) + 1;
      });

      purchaseOrders?.forEach((po: any) => {
        if (!po.created_by) return;
        if (!actualsByUser[po.created_by]) actualsByUser[po.created_by] = {};
        actualsByUser[po.created_by].po_count = 
          (actualsByUser[po.created_by].po_count || 0) + 1;
        actualsByUser[po.created_by].po_value = 
          (actualsByUser[po.created_by].po_value || 0) + Number(po.grand_total || 0);
      });

      const targetProgress = (targets || []).map((target: any) => {
        const actual = actualsByUser[target.user_id]?.[target.metric] || 0;
        const progress = target.target_value > 0 ? (actual / target.target_value) * 100 : 0;
        
        const today = new Date();
        const totalDays = new Date(year, month, 0).getDate();
        const daysElapsed = Math.min(today.getDate(), totalDays);
        const expectedProgress = (daysElapsed / totalDays) * 100;
        
        let status: 'ahead' | 'on-track' | 'behind' = 'on-track';
        if (progress > expectedProgress + 10) status = 'ahead';
        else if (progress < expectedProgress - 10) status = 'behind';

        return {
          ...target,
          userName: target.profiles?.full_name || 'Unknown',
          actual,
          progress,
          status,
        };
      });

      return {
        targets: targetProgress,
        hasTargets: targetProgress.length > 0,
      };
    },
  });
}

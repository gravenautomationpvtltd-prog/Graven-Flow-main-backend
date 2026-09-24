import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Info } from 'lucide-react';
import { useLeaveBalance } from '@/hooks/useAttendanceStats';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface MyLeaveRequestsProps {
  userId: string;
  onRequestLeave: () => void;
}

export function MyLeaveRequests({ userId, onRequestLeave }: MyLeaveRequestsProps) {
  const { data: leaveData, isLoading } = useLeaveBalance(userId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Skeleton className="h-32 w-32 rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const used = leaveData?.used || 0;
  const total = leaveData?.total || 32;
  const remaining = leaveData?.remaining || total;

  const chartData = [
    { name: 'Used', value: used, color: 'hsl(var(--muted-foreground))' },
    { name: 'Remaining', value: remaining, color: 'hsl(var(--primary))' },
  ];

  // If no leaves used, adjust for visual
  if (used === 0) {
    chartData[0].value = 0.001;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Leave Balance</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Info className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Casual: {leaveData?.byType?.casual || 0} used</p>
                <p>Sick: {leaveData?.byType?.sick || 0} used</p>
                <p>Earned: {leaveData?.byType?.earned || 0} used</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-6">
          {/* Donut Chart */}
          <div className="relative w-28 h-28 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={50}
                  paddingAngle={2}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold">{remaining}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Left</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-muted-foreground/50" />
              <span className="text-sm text-muted-foreground">Used ({used})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-sm text-muted-foreground">Total ({total})</span>
            </div>
          </div>
        </div>

        {/* Request Button */}
        <Button 
          className="w-full mt-4" 
          variant="outline" 
          onClick={onRequestLeave}
        >
          <Plus className="h-4 w-4 mr-2" />
          Request Leave
        </Button>
      </CardContent>
    </Card>
  );
}

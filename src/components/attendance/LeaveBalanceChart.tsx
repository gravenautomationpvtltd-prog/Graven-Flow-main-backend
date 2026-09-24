import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useLeaveBalance } from '@/hooks/useAttendanceStats';
import { Skeleton } from '@/components/ui/skeleton';

interface LeaveBalanceChartProps {
  userId: string;
}

const COLORS = {
  remaining: 'hsl(var(--primary))',
  casual: 'hsl(142, 76%, 36%)', // green
  sick: 'hsl(0, 84%, 60%)', // red
  earned: 'hsl(217, 91%, 60%)', // blue
  emergency: 'hsl(45, 93%, 47%)', // yellow
};

export function LeaveBalanceChart({ userId }: LeaveBalanceChartProps) {
  const { data: leaveData, isLoading } = useLeaveBalance(userId);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="h-32 w-32 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
    );
  }

  if (!leaveData) return null;

  const chartData = [
    { name: 'Remaining', value: leaveData.remaining, color: COLORS.remaining },
    { name: 'Casual', value: leaveData.byType.casual, color: COLORS.casual },
    { name: 'Sick', value: leaveData.byType.sick, color: COLORS.sick },
    { name: 'Earned', value: leaveData.byType.earned, color: COLORS.earned },
    { name: 'Emergency', value: leaveData.byType.emergency, color: COLORS.emergency },
  ].filter(item => item.value > 0);

  // If no leaves used, show full circle as remaining
  if (chartData.length === 1 && chartData[0].name === 'Remaining') {
    chartData.push({ name: 'Used', value: 0.001, color: 'hsl(var(--muted))' });
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-36">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={60}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-popover text-popover-foreground px-3 py-2 rounded-md shadow-lg border text-sm">
                      <span className="font-medium">{data.name}</span>: {data.value} days
                    </div>
                  );
                }
                return null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{leaveData.remaining}</span>
          <span className="text-xs text-muted-foreground">days left</span>
        </div>
      </div>
      
      {/* Legend */}
      <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs">
        {chartData.filter(d => d.name !== 'Used').map((item) => (
          <div key={item.name} className="flex items-center gap-1.5">
            <div 
              className="w-2.5 h-2.5 rounded-full" 
              style={{ backgroundColor: item.color }}
            />
            <span className="text-muted-foreground">
              {item.name} ({item.value})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

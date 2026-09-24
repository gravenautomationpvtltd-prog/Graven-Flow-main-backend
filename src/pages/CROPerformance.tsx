import { Users2, Phone, TrendingUp, Clock, UserCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useCROPerformance } from '@/hooks/useCROPerformance';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';

export default function CROPerformance() {
  const { data, isLoading } = useCROPerformance();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const performers = data?.performers || [];
  const summary = data?.summary;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">CRO Performance</h1>
        <p className="text-muted-foreground">Monitor Customer Retention Officer performance and KPIs</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total CROs</p>
                <p className="text-2xl font-bold text-foreground">{summary?.total_cros || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/50 flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Assignments</p>
                <p className="text-2xl font-bold text-foreground">{summary?.total_assignments || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Phone className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Contact Rate</p>
                <p className="text-2xl font-bold text-foreground">{summary?.overall_contact_rate || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Enquiries Generated</p>
                <p className="text-2xl font-bold text-foreground">{summary?.total_enquiries || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CRO Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">CRO Rankings</CardTitle>
        </CardHeader>
        <CardContent>
          {performers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No CRO data available</p>
          ) : (
            <div className="space-y-4">
              {performers.map((cro, index) => (
                <div
                  key={cro.cro_user_id}
                  className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/cro-performance/${cro.cro_user_id}`)}
                >
                  {/* Rank */}
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-primary">#{index + 1}</span>
                  </div>

                  {/* Name & Email */}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">{cro.cro_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{cro.cro_email}</p>
                  </div>

                  {/* Status Breakdown */}
                  <div className="hidden md:flex items-center gap-2 flex-1">
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Progress</span>
                        <span>{cro.contacted + cro.enquiries}/{cro.total_assigned}</span>
                      </div>
                      <Progress value={cro.contact_rate} className="h-2" />
                    </div>
                  </div>

                  {/* KPI Badges */}
                  <div className="hidden lg:flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {cro.total_assigned} assigned
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {cro.contacted} contacted
                    </Badge>
                    <Badge className="text-xs bg-green-600 hover:bg-green-700">
                      {cro.enquiries} enquiries
                    </Badge>
                    {cro.no_response > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {cro.no_response} no response
                      </Badge>
                    )}
                  </div>

                  {/* Contact Rate & Last Active */}
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-foreground">{cro.contact_rate}%</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                      <Clock className="h-3 w-3" />
                      {cro.last_activity
                        ? formatDistanceToNow(new Date(cro.last_activity), { addSuffix: true })
                        : 'No activity'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

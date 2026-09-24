import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useBoq, useUpdateBoq, useHandoffBoq, type BoqStatus, type BoqFeasibility } from '@/hooks/useBoqs';
import { BoqItemsEditor } from '@/components/tst/BoqItemsEditor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Send, Save, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export default function BoqDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: boq, isLoading } = useBoq(id);
  const update = useUpdateBoq();
  const handoff = useHandoffBoq();

  const [status, setStatus] = useState<BoqStatus>('draft');
  const [feasibility, setFeasibility] = useState<BoqFeasibility | ''>('');
  const [techNotes, setTechNotes] = useState('');
  const [feasibilityNotes, setFeasibilityNotes] = useState('');

  useEffect(() => {
    if (boq) {
      setStatus(boq.status);
      setFeasibility(boq.feasibility || '');
      setTechNotes(boq.technical_notes || '');
      setFeasibilityNotes(boq.feasibility_notes || '');
    }
  }, [boq]);

  if (isLoading) return <Skeleton className="h-96" />;
  if (!boq) return <p>BOQ not found</p>;

  const handleSave = async () => {
    await update.mutateAsync({
      id: boq.id,
      status,
      feasibility: (feasibility || null) as any,
      technical_notes: techNotes,
      feasibility_notes: feasibilityNotes,
    });
  };

  const handleHandoff = async () => {
    if (feasibility === 'not_feasible') {
      toast.error('Cannot hand off a BOQ marked Not Feasible');
      return;
    }
    await handoff.mutateAsync(boq.id);
  };

  const isHandedOff = boq.status === 'handed_off';

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate('/tst')}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to TST Queue
      </Button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">
            BOQ — {boq.lead?.customer?.company_name || 'Unknown'}
          </h1>
          <p className="text-muted-foreground text-sm">
            Lead: <Link to={`/leads/${boq.lead_id}`} className="text-primary underline-offset-2 hover:underline inline-flex items-center gap-1">
              View lead <ExternalLink className="h-3 w-3" />
            </Link>
          </p>
        </div>
        {isHandedOff && (
          <Badge variant="outline" className="bg-indigo-500/10 text-indigo-700 border-indigo-500/20">
            <Send className="h-3 w-3 mr-1" /> Handed Off to Sales
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Customer Requirement</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {boq.lead?.customer_query || 'No requirement text captured.'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Status & Feasibility</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as BoqStatus)} disabled={isHandedOff}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="ready_for_sales">Ready for Sales</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Feasibility</Label>
            <Select value={feasibility || 'unset'} onValueChange={(v) => setFeasibility(v === 'unset' ? '' : v as BoqFeasibility)} disabled={isHandedOff}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unset">— Not assessed —</SelectItem>
                <SelectItem value="feasible">Feasible</SelectItem>
                <SelectItem value="needs_clarification">Needs Clarification</SelectItem>
                <SelectItem value="not_feasible">Not Feasible</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Bill of Quantities</CardTitle></CardHeader>
        <CardContent>
          <BoqItemsEditor boqId={boq.id} readOnly={isHandedOff} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Technical Notes</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Design / calculation notes</Label>
            <Textarea rows={4} value={techNotes} onChange={(e) => setTechNotes(e.target.value)} disabled={isHandedOff} />
          </div>
          <div>
            <Label>Feasibility notes</Label>
            <Textarea rows={3} value={feasibilityNotes} onChange={(e) => setFeasibilityNotes(e.target.value)} disabled={isHandedOff} />
          </div>
        </CardContent>
      </Card>

      {!isHandedOff && (
        <div className="flex items-center justify-end gap-3 sticky bottom-4 bg-background/80 backdrop-blur p-3 border rounded-lg">
          <Button variant="outline" onClick={handleSave} disabled={update.isPending}>
            <Save className="h-4 w-4 mr-2" /> Save
          </Button>
          <Button onClick={handleHandoff} disabled={handoff.isPending || feasibility === 'not_feasible'}>
            <Send className="h-4 w-4 mr-2" /> Hand off to Sales
          </Button>
        </div>
      )}
    </div>
  );
}

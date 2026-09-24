import { useState } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, ClipboardCheck, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { AnyBIETable, BIERow } from '@/hooks/useBIEWork';
import { useReviewBIEWork } from '@/hooks/useBIEWork';

const typeLabels: Record<string, string> = {
  vendor_registrations: 'Vendor registration',
  tenders: 'Tender',
  website_listings: 'Website listing',
  product_assignments: 'Product work',
};

export function ReviewQueue({
  rows,
  nameOf,
}: {
  rows: BIERow[];
  nameOf: (id: string | null) => string;
}) {
  const review = useReviewBIEWork();
  const [reworkRow, setReworkRow] = useState<BIERow | null>(null);
  const [note, setNote] = useState('');

  const pending = rows.filter((row) => row.review_status === 'submitted');

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Needs my review
            {pending.length > 0 && <Badge variant="destructive">{pending.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {pending.map((row) => (
            <div key={`${row.type}-${row.id}`} className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{row.title}</p>
                <p className="text-sm text-muted-foreground">
                  {typeLabels[row.type]} · {nameOf(row.assigned_to)}
                  {row.raw.submitted_at ? ` · sent ${format(new Date(String(row.raw.submitted_at)), 'dd MMM')}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => review.mutate({ table: row.type as AnyBIETable, id: row.id, decision: 'approved' })}
                  disabled={review.isPending}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setReworkRow(row); setNote(''); }}>
                  <RotateCcw className="mr-2 h-4 w-4" />Send back
                </Button>
              </div>
            </div>
          ))}
          {!pending.length && <p className="py-8 text-center text-muted-foreground">Nothing waiting for your review</p>}
        </CardContent>
      </Card>

      <Dialog open={!!reworkRow} onOpenChange={(open) => !open && setReworkRow(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send back for rework</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rework-note">What needs fixing?</Label>
            <Textarea id="rework-note" value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReworkRow(null)}>Cancel</Button>
            <Button
              disabled={review.isPending}
              onClick={async () => {
                if (!reworkRow) return;
                await review.mutateAsync({
                  table: reworkRow.type as AnyBIETable,
                  id: reworkRow.id,
                  decision: 'rework',
                  note,
                });
                setReworkRow(null);
              }}
            >
              Send back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

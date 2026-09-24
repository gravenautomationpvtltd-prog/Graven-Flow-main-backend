import { useState } from 'react';
import { format } from 'date-fns';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Target, Check, X, RefreshCw } from 'lucide-react';
import { usePriceRounds, useSetSalesOutcome, useSetRoundDecision } from '@/hooks/usePriceRequestQuotes';
import type { EnquiryPriceRequest } from '@/hooks/useEnquiryPriceRequests';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  itemName?: string;
  request: EnquiryPriceRequest | null;
  /** Sales shortcut: ask procurement for a target price / revised price. */
  onRequestReprice?: () => void;
}

const inr = (n?: number | null) =>
  n == null ? '—' : `₹${Math.round(Number(n)).toLocaleString('en-IN')}`;

const OUTCOMES = ['quoted', 'won', 'lost', 'on_hold'];

export function PriceThreadSheet({ open, onOpenChange, itemName, request, onRequestReprice }: Props) {
  const { data: rounds = [], isLoading } = usePriceRounds(request?.id);
  const setOutcome = useSetSalesOutcome();
  const setDecision = useSetRoundDecision();
  const [roundNotes, setRoundNotes] = useState<Record<string, string>>({});
  const [outcomeNotes, setOutcomeNotes] = useState('');

  if (!request) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="pr-8">{itemName || 'Price request'}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{request.status.replace('_', ' ')}</Badge>
            <Badge variant="outline">Round {request.current_round || 1}</Badge>
            {request.target_matched_at && (
              <Badge className="bg-green-500/10 text-green-600 border-green-200">
                <Target className="h-3 w-3 mr-1" /> Target matched
              </Badge>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Target asked</p>
            <p className="font-medium">{inr(request.target_rate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Price from procurement</p>
            <p className="font-medium">{inr(request.resolved_price)}</p>
          </div>
          {request.price_valid_until && (
            <div>
              <p className="text-xs text-muted-foreground">Valid until</p>
              <p className="font-medium">
                {format(new Date(request.price_valid_until), 'dd MMM yyyy')}
              </p>
            </div>
          )}
        </div>

        {onRequestReprice && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onRequestReprice}>
              <Target className="h-3.5 w-3.5 mr-1" /> Ask target price
            </Button>
            <Button size="sm" variant="outline" onClick={onRequestReprice}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Request reprice
            </Button>
          </div>
        )}

        <Separator className="my-4" />

        <h3 className="text-sm font-semibold mb-2">Negotiation rounds</h3>
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : rounds.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No revision requested yet. Use “Request Reprice” on the item to ask procurement for a
            better price.
          </p>
        ) : (
          <div className="space-y-2">
            {rounds.map((r) => {
              const answered = r.outcome !== 'open';
              const decided = !!r.sales_decision;
              return (
                <Card key={r.id}>
                  <CardContent className="p-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">Round {r.round}</span>
                      <div className="flex items-center gap-1">
                        <Badge variant={r.outcome === 'open' ? 'secondary' : 'outline'}>
                          {r.outcome}
                        </Badge>
                        {decided && (
                          <Badge
                            className={
                              r.sales_decision === 'accepted'
                                ? 'bg-green-500/10 text-green-600 border-green-200'
                                : 'bg-destructive/10 text-destructive border-destructive/20'
                            }
                          >
                            {r.sales_decision}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Asked {inr(r.target_price)}
                      {r.revised_price != null && ` · revised to ${inr(r.revised_price)}`}
                      {` · ${format(new Date(r.requested_at), 'dd MMM yy')}`}
                    </p>
                    {r.notes && <p className="text-xs">{r.notes}</p>}

                    {decided ? (
                      <p className="text-xs text-muted-foreground">
                        {r.sales_decision_notes && <span>“{r.sales_decision_notes}” · </span>}
                        {r.sales_decision_at &&
                          format(new Date(r.sales_decision_at), 'dd MMM yy, HH:mm')}
                      </p>
                    ) : answered ? (
                      <div className="space-y-2 pt-1">
                        <Label className="text-xs">Your decision on this price</Label>
                        <Textarea
                          rows={2}
                          placeholder="Notes (why accepted / rejected, customer feedback…)"
                          value={roundNotes[r.id] ?? ''}
                          onChange={(e) =>
                            setRoundNotes((p) => ({ ...p, [r.id]: e.target.value }))
                          }
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={setDecision.isPending}
                            onClick={() =>
                              setDecision.mutate({
                                roundId: r.id,
                                priceRequestId: request.id,
                                decision: 'accepted',
                                notes: roundNotes[r.id],
                                responderId: r.responder_id,
                                productText: itemName,
                              })
                            }
                          >
                            <Check className="h-3.5 w-3.5 mr-1" /> Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={setDecision.isPending}
                            onClick={() =>
                              setDecision.mutate({
                                roundId: r.id,
                                priceRequestId: request.id,
                                decision: 'rejected',
                                notes: roundNotes[r.id],
                                responderId: r.responder_id,
                                productText: itemName,
                              })
                            }
                          >
                            <X className="h-3.5 w-3.5 mr-1" /> Reject
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Waiting on procurement to respond.
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {request.target_matched_at && (
          <>
            <Separator className="my-4" />
            <h3 className="text-sm font-semibold mb-2">What did you do with this price?</h3>
            <div className="flex flex-wrap gap-2">
              {OUTCOMES.map((o) => (
                <Button
                  key={o}
                  size="sm"
                  variant={request.sales_outcome === o ? 'default' : 'outline'}
                  disabled={setOutcome.isPending}
                  onClick={() =>
                    setOutcome.mutate({
                      id: request.id,
                      outcome: o,
                      notes: outcomeNotes || undefined,
                    })
                  }
                >
                  {o.replace('_', ' ')}
                </Button>
              ))}
            </div>
            <div className="space-y-1 mt-3">
              <Label className="text-xs">Outcome notes</Label>
              <Textarea
                rows={2}
                placeholder="Add context for this outcome…"
                value={outcomeNotes}
                onChange={(e) => setOutcomeNotes(e.target.value)}
              />
              {request.sales_outcome_notes && (
                <p className="text-xs text-muted-foreground">
                  Saved: “{request.sales_outcome_notes}”
                </p>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

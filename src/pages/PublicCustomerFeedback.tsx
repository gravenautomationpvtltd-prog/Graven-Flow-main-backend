import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Star, CheckCircle2, AlertCircle, ShieldCheck, Loader2, HeartHandshake } from 'lucide-react';

const LOW_RATING_REASONS = [
  'Solution not provided',
  'Requirement not resolved',
  'Delayed response',
  'Communication issue',
  'Product information unclear',
  'Other',
];

export default function PublicCustomerFeedback() {
  const { token } = useParams<{ token: string }>();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rawToken, setRawToken] = useState<any>(null);

  // Form State
  const [rating, setRating] = useState<number>(5);
  const [requirementResolved, setRequirementResolved] = useState<'yes' | 'partially' | 'no'>('yes');
  const [teamRating, setTeamRating] = useState<'excellent' | 'good' | 'average' | 'poor'>('excellent');
  const [likedAspects, setLikedAspects] = useState('');
  const [improvementAreas, setImprovementAreas] = useState('');
  const [comments, setComments] = useState('');
  const [selectedLowReasons, setSelectedLowReasons] = useState<string[]>([]);

  useEffect(() => {
    async function loadToken() {
      if (!token) {
        setError('No feedback token provided.');
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await (supabase as any)
          .from('feedback_tokens')
          .select('*')
          .eq('token', token)
          .single();

        if (error || !data) {
          setError('This feedback link is invalid or expired.');
          setLoading(false);
          return;
        }

        if (data.is_used) {
          setSubmitted(true);
          setLoading(false);
          return;
        }

        if (data.expires_at && new Date(data.expires_at) < new Date()) {
          setError('This feedback link has expired.');
          setLoading(false);
          return;
        }

        setRawToken(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load feedback form.');
      } finally {
        setLoading(false);
      }
    }

    loadToken();
  }, [token]);

  const toggleLowReason = (reason: string) => {
    setSelectedLowReasons((prev) =>
      prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !rawToken) return;

    setSubmitting(true);
    setError(null);

    try {
      // 1. Insert customer feedback record
      const { error: insertError } = await (supabase as any)
        .from('customer_feedback')
        .insert({
          tenant_id: rawToken.tenant_id,
          feedback_token_id: rawToken.id,
          tst_case_id: rawToken.tst_case_id || null,
          customer_id: rawToken.customer_id || null,
          lead_id: rawToken.lead_id || null,
          interaction_id: rawToken.interaction_id || null,
          employee_id: rawToken.employee_id || null,
          rating,
          requirement_resolved: requirementResolved,
          team_rating: teamRating,
          liked_aspects: likedAspects,
          improvement_areas: improvementAreas,
          comments,
          low_rating_reasons: rating <= 3 ? selectedLowReasons : [],
        });

      if (insertError) throw insertError;

      // 2. Mark token as used to prevent duplicate submissions
      await (supabase as any)
        .from('feedback_tokens')
        .update({ is_used: true })
        .eq('id', rawToken.id);

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-sm text-slate-500">Loading feedback form...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-lg border-red-100">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle className="text-xl">Feedback Unavailable</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50/50 to-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-xl border-emerald-100 text-center p-6 space-y-4">
          <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <HeartHandshake className="h-10 w-10" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">Thank You for Your Feedback!</CardTitle>
          <CardDescription className="text-base text-slate-600">
            Your valuable review has been received. Our leadership and technical engineering team appreciate your support in helping us maintain the highest standard of service.
          </CardDescription>
          <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Verified Customer Feedback · Graven Automation
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl">
              G
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Graven Automation</h1>
              <p className="text-xs text-slate-500">Customer Satisfaction & Technical Support Review</p>
            </div>
          </div>
        </div>

        <Card className="shadow-md border-slate-200">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">How was your experience?</CardTitle>
            <CardDescription>
              Please rate your recent consultation with our Technical Solutions Team (TST).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Star Rating */}
              <div className="text-center py-4 bg-slate-50/70 rounded-xl border border-slate-100">
                <Label className="block text-sm font-medium text-slate-700 mb-3">Overall Rating</Label>
                <div className="flex items-center justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="p-1.5 focus:outline-none transition-transform hover:scale-110"
                    >
                      <Star
                        className={`h-9 w-9 ${
                          star <= rating
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-2 font-medium">
                  {rating === 5 && '🌟 Exceptional / Fully Satisfied'}
                  {rating === 4 && '👍 Good / Helpful Support'}
                  {rating === 3 && '😐 Average / Room for Improvement'}
                  {rating === 2 && '👎 Below Expectations'}
                  {rating === 1 && '⚠️ Very Unsatisfied'}
                </p>
              </div>

              {/* Requirement Resolved Question */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700">Was your requirement resolved?</Label>
                <RadioGroup
                  value={requirementResolved}
                  onValueChange={(val: any) => setRequirementResolved(val)}
                  className="flex gap-4 flex-wrap"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="req-yes" />
                    <Label htmlFor="req-yes">Yes, completely</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="partially" id="req-partially" />
                    <Label htmlFor="req-partially">Partially</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="req-no" />
                    <Label htmlFor="req-no">No, unresolved</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Team Rating Question */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700">How was our Technical Support Team (TST)?</Label>
                <RadioGroup
                  value={teamRating}
                  onValueChange={(val: any) => setTeamRating(val)}
                  className="grid grid-cols-2 sm:grid-cols-4 gap-2"
                >
                  <div className="flex items-center space-x-2 border rounded-lg p-2.5 hover:bg-slate-50 cursor-pointer">
                    <RadioGroupItem value="excellent" id="team-exc" />
                    <Label htmlFor="team-exc" className="cursor-pointer">Excellent</Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-lg p-2.5 hover:bg-slate-50 cursor-pointer">
                    <RadioGroupItem value="good" id="team-good" />
                    <Label htmlFor="team-good" className="cursor-pointer">Good</Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-lg p-2.5 hover:bg-slate-50 cursor-pointer">
                    <RadioGroupItem value="average" id="team-avg" />
                    <Label htmlFor="team-avg" className="cursor-pointer">Average</Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-lg p-2.5 hover:bg-slate-50 cursor-pointer">
                    <RadioGroupItem value="poor" id="team-poor" />
                    <Label htmlFor="team-poor" className="cursor-pointer">Poor</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Low Rating Additional Reasons */}
              {rating <= 3 && (
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-lg space-y-3">
                  <Label className="text-xs font-semibold text-amber-900 uppercase tracking-wide">
                    What issues did you experience? (Select all that apply)
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {LOW_RATING_REASONS.map((reason) => (
                      <div key={reason} className="flex items-center space-x-2">
                        <Checkbox
                          id={`reason-${reason}`}
                          checked={selectedLowReasons.includes(reason)}
                          onCheckedChange={() => toggleLowReason(reason)}
                        />
                        <Label htmlFor={`reason-${reason}`} className="text-sm font-normal text-amber-950">
                          {reason}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Qualitative feedback */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="liked">What did you like about our service?</Label>
                  <Textarea
                    id="liked"
                    rows={2}
                    value={likedAspects}
                    onChange={(e) => setLikedAspects(e.target.value)}
                    placeholder="e.g. Prompt engineer callback, clear product explanation..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="improve">What can we improve?</Label>
                  <Textarea
                    id="improve"
                    rows={2}
                    value={improvementAreas}
                    onChange={(e) => setImprovementAreas(e.target.value)}
                    placeholder="e.g. Faster quotation delivery, better technical documentation..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="comments">Additional Comments / Suggestions</Label>
                  <Textarea
                    id="comments"
                    rows={2}
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Any other thoughts for our management..."
                  />
                </div>
              </div>

              <Button type="submit" size="lg" className="w-full gap-2 text-base" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> Submitting Review...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5" /> Submit Feedback
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

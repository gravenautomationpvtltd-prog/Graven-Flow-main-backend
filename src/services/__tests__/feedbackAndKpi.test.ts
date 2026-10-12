import { describe, it, expect } from 'vitest';

describe('TST Management Feedback & Resolution Metrics Calculation', () => {
  it('calculates average rating and positive/negative percentages accurately', () => {
    const feedbackList = [
      { rating: 5, requirement_resolved: 'yes' },
      { rating: 5, requirement_resolved: 'yes' },
      { rating: 4, requirement_resolved: 'yes' },
      { rating: 2, requirement_resolved: 'no' },
      { rating: 1, requirement_resolved: 'no' },
    ];

    const totalFeedback = feedbackList.length;
    const totalRatingSum = feedbackList.reduce((sum, f) => sum + f.rating, 0);
    const avgRating = (totalRatingSum / totalFeedback).toFixed(1);
    const positiveFeedback = feedbackList.filter((f) => f.rating >= 4).length;
    const negativeFeedback = feedbackList.filter((f) => f.rating <= 2).length;
    const positivePct = Math.round((positiveFeedback / totalFeedback) * 100);

    expect(totalFeedback).toBe(5);
    expect(avgRating).toBe('3.4');
    expect(positiveFeedback).toBe(3);
    expect(negativeFeedback).toBe(2);
    expect(positivePct).toBe(60);
  });

  it('calculates case resolution rate correctly from distinct records', () => {
    const cases = [
      { id: '1', status: 'resolved' },
      { id: '2', status: 'resolved' },
      { id: '3', status: 'in_progress' },
      { id: '4', status: 'follow_up' },
    ];

    const total = cases.length;
    const resolved = cases.filter((c) => c.status === 'resolved').length;
    const resolutionRate = Math.round((resolved / total) * 100);

    expect(resolutionRate).toBe(50);
  });
});

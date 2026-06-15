import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findScheduledNotificationQuoteId,
  pickTodayQuote,
  saveScheduledNotificationQuotes,
} from './quotePool';

describe('quotePool notification alignment', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 7, 30, 0));
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('uses the scheduled notification quote as today quote', () => {
    saveScheduledNotificationQuotes([
      { date: '2026-06-15', quoteId: 'ko-motivation-0002' },
    ]);

    const result = pickTodayQuote({
      preferredThemes: ['motivation'],
      language: 'ko',
    });

    expect(result?.quote.id).toBe('ko-motivation-0002');
    expect(localStorage.getItem('quote.todayId')).toBe('ko-motivation-0002');
    expect(findScheduledNotificationQuoteId()).toBe('ko-motivation-0002');
  });

  it('replaces a stale same-day cached quote with the scheduled notification quote', () => {
    localStorage.setItem('quote.lastDate', '2026-06-15');
    localStorage.setItem('quote.todayId', 'ko-motivation-0001');
    saveScheduledNotificationQuotes([
      { date: '2026-06-15', quoteId: 'ko-motivation-0003' },
    ]);

    const result = pickTodayQuote({
      preferredThemes: ['motivation'],
      language: 'ko',
    });

    expect(result?.quote.id).toBe('ko-motivation-0003');
    expect(result?.isFresh).toBe(true);
    expect(localStorage.getItem('quote.todayId')).toBe('ko-motivation-0003');
  });
});

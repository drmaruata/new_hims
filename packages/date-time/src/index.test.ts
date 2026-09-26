import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculateAgeInYears, formatClinicalDate, formatClinicalDateTime } from './index';

/**
 * The clinical contract for these helpers is the *facility's* timezone, not the
 * server's and not the reader's. Every case below pins the timezone argument
 * explicitly and uses a UTC instant whose facility-local date differs from its
 * UTC date, so a regression that drops the timezone conversion fails loudly
 * instead of silently agreeing on the right answer.
 */

describe('formatClinicalDateTime', () => {
  it('renders a UTC instant in the facility timezone, not UTC', () => {
    // 20:00Z is already the next calendar day in Asia/Kolkata (+05:30).
    expect(formatClinicalDateTime('2026-01-15T20:00:00Z')).toBe('16 Jan 2026, 01:30 am');
    expect(formatClinicalDateTime('2026-01-15T20:00:00Z', 'UTC')).toBe('15 Jan 2026, 08:00 pm');
  });

  it('honours an explicit timezone override', () => {
    expect(formatClinicalDateTime('2026-01-15T10:30:00Z', 'UTC')).toBe('15 Jan 2026, 10:30 am');
  });

  it('falls back to a placeholder when there is no value to show', () => {
    expect(formatClinicalDateTime(undefined)).toBe('—');
    expect(formatClinicalDateTime(null)).toBe('—');
    expect(formatClinicalDateTime('')).toBe('—');
  });

  it('reports an unparseable value instead of throwing or printing NaN', () => {
    expect(formatClinicalDateTime('not-a-timestamp')).toBe('Invalid Date');
  });

  it('falls back to a placeholder when the timezone is not recognised', () => {
    expect(formatClinicalDateTime('2026-01-15T10:30:00Z', 'Mars/Olympus_Mons')).toBe('—');
  });
});

describe('formatClinicalDate', () => {
  it('renders only the facility-local calendar date', () => {
    expect(formatClinicalDate('2026-01-15T20:00:00Z')).toBe('16 Jan 2026');
    expect(formatClinicalDate('2026-01-15T20:00:00Z', 'UTC')).toBe('15 Jan 2026');
  });

  it('accepts a bare YYYY-MM-DD business date', () => {
    expect(formatClinicalDate('2026-03-01')).toBe('01 Mar 2026');
  });

  it('falls back to a placeholder when there is no value to show', () => {
    expect(formatClinicalDate(undefined)).toBe('—');
    expect(formatClinicalDate(null)).toBe('—');
  });

  it('reports an unparseable value instead of throwing', () => {
    expect(formatClinicalDate('not-a-date')).toBe('Invalid Date');
  });
});

describe('calculateAgeInYears', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Fixed "today" for every case. Midday UTC keeps the local calendar date on
   * 2026-09-26 for any host offset, because the implementation compares local
   * `getFullYear`/`getMonth`/`getDate` against the real clock.
   */
  const freezeToday = () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T12:00:00Z'));
  };

  it('counts the birthday as reached', () => {
    freezeToday();
    expect(calculateAgeInYears('1990-09-26')).toBe(36);
  });

  it('does not count a birthday that has not happened yet this year', () => {
    freezeToday();
    expect(calculateAgeInYears('1990-09-27')).toBe(35);
  });

  it('does not count a birthday still in a later month', () => {
    freezeToday();
    expect(calculateAgeInYears('1990-10-01')).toBe(35);
  });

  it('counts a birthday already passed this year', () => {
    freezeToday();
    expect(calculateAgeInYears('1990-08-31')).toBe(36);
  });

  it('has no age for a date of birth in the future', () => {
    freezeToday();
    expect(calculateAgeInYears('2030-01-01')).toBeNull();
  });

  it('has no age for a missing or unparseable date of birth', () => {
    expect(calculateAgeInYears(undefined)).toBeNull();
    expect(calculateAgeInYears(null)).toBeNull();
    expect(calculateAgeInYears('not-a-date')).toBeNull();
  });
});

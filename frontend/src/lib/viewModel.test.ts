import { describe, expect, it } from 'vitest';
import { formatInr, percent, scoreTone } from './viewModel';

describe('view model helpers', () => {
  it('formats Indian currency and percentages', () => {
    expect(formatInr(124850)).toContain('1,24,850');
    expect(percent(0.9628)).toBe('96.3%');
  });

  it('maps scores to product tones', () => {
    expect(scoreTone(90)).toBe('critical');
    expect(scoreTone(70)).toBe('warning');
    expect(scoreTone(20)).toBe('healthy');
  });
});


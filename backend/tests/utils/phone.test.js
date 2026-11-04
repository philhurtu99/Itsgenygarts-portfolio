import { describe, it, expect } from '@jest/globals';
import { formatPhoneForCountry, normalizePhoneCountry } from '../../src/utils/phone.js';

describe('formatPhoneForCountry', () => {
  it('formats Canadian numbers as requested', () => {
    expect(formatPhoneForCountry('5145551212', 'CA')).toBe('(514)-555-1212');
    expect(formatPhoneForCountry('1 (514) 555-1212', 'Canada')).toBe('(514)-555-1212');
  });

  it('formats US numbers with the same NANP pattern', () => {
    expect(formatPhoneForCountry('2125559876', 'US')).toBe('(212)-555-9876');
  });

  it('formats French numbers with French grouping', () => {
    expect(formatPhoneForCountry('0123456789', 'FR')).toBe('01 23 45 67 89');
    expect(formatPhoneForCountry('+33123456789', 'France')).toBe('+33 1 23 45 67 89');
  });

  it('formats international fallback numbers in readable groups', () => {
    expect(formatPhoneForCountry('+5511987654321', 'BR')).toBe('+551 198 765 432 1');
  });
});

describe('normalizePhoneCountry', () => {
  it('normalizes supported country labels', () => {
    expect(normalizePhoneCountry('Canada')).toBe('NANP');
    expect(normalizePhoneCountry('United States')).toBe('NANP');
    expect(normalizePhoneCountry('Royaume-Uni')).toBe('GB');
  });
});

import {
  getSubdivisionLabel,
  getSubdivisionOptions,
  isValidCountryCode,
  isSubdivisionRequired,
  normalizeCountryCode,
  normalizeSubdivisionCode,
} from '../../src/utils/address.js';

describe('address helpers', () => {
  it('normalizes country aliases', () => {
    expect(normalizeCountryCode('Canada')).toBe('CA');
    expect(normalizeCountryCode('États-Unis')).toBe('US');
    expect(normalizeCountryCode('United Kingdom')).toBe('GB');
    expect(normalizeCountryCode('de')).toBe('DE');
    expect(normalizeCountryCode('')).toBe('');
  });

  it('requires a real two-letter country code', () => {
    expect(isValidCountryCode('US')).toBe(true);
    expect(isValidCountryCode('de')).toBe(true);
    expect(isValidCountryCode('OTHER')).toBe(false);
    expect(isValidCountryCode('D')).toBe(false);
  });

  it('returns dynamic subdivisions per country', () => {
    expect(getSubdivisionOptions('CA').some(([code]) => code === 'QC')).toBe(true);
    expect(getSubdivisionOptions('US').some(([code]) => code === 'NY')).toBe(true);
    expect(getSubdivisionOptions('FR').some(([code]) => code === 'IDF')).toBe(true);
    expect(getSubdivisionOptions('GB').some(([code]) => code === 'SCT')).toBe(true);
  });

  it('normalizes Mapbox subdivision short codes', () => {
    expect(normalizeSubdivisionCode('CA', 'CA-QC')).toBe('QC');
    expect(normalizeSubdivisionCode('US', 'US-CA')).toBe('CA');
    expect(normalizeSubdivisionCode('FR', 'FR-IDF')).toBe('IDF');
  });

  it('labels stored subdivision codes', () => {
    expect(getSubdivisionLabel('US', 'CA')).toBe('California');
    expect(getSubdivisionLabel('CA', 'QC')).toBe('Quebec');
  });

  it('requires subdivisions for Canada and the US', () => {
    expect(isSubdivisionRequired('CA')).toBe(true);
    expect(isSubdivisionRequired('US')).toBe(true);
    expect(isSubdivisionRequired('FR')).toBe(false);
  });
});

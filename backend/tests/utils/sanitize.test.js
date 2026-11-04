import { describe, it, expect } from '@jest/globals';
import { cleanText } from '../../src/utils/sanitize.js';

describe('cleanText', () => {
  it('returns the input unchanged when it contains no HTML', () => {
    expect(cleanText('Hello world')).toBe('Hello world');
  });

  it('strips all HTML tags', () => {
    expect(cleanText('<p>Hello <b>world</b></p>')).toBe('Hello world');
  });

  it('removes script tags and their content', () => {
    expect(cleanText('Safe<script>alert("xss")</script>text')).toBe('Safetext');
  });

  it('trims leading and trailing whitespace', () => {
    expect(cleanText('   padded   ')).toBe('padded');
  });

  it('truncates to the default maxLength of 5000', () => {
    const input = 'a'.repeat(6000);
    expect(cleanText(input)).toHaveLength(5000);
  });

  it('truncates to a custom maxLength', () => {
    expect(cleanText('abcdefghij', 5)).toBe('abcde');
  });

  it('returns null when input is null', () => {
    expect(cleanText(null)).toBeNull();
  });

  it('returns undefined when input is undefined', () => {
    expect(cleanText(undefined)).toBeUndefined();
  });

  it('coerces non-string inputs to strings', () => {
    expect(cleanText(42)).toBe('42');
    expect(cleanText(true)).toBe('true');
  });

  it('handles empty strings', () => {
    expect(cleanText('')).toBe('');
  });
});

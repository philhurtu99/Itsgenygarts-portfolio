import { describe, expect, it } from '@jest/globals';
import { customsFieldsFromBody, categoryCustomsFieldsFromBody } from '../../src/utils/customsFields.js';
import { CUSTOMS_PROFILES } from '../../src/utils/customsProfiles.js';

describe('customsFieldsFromBody', () => {
  it('normalizes category origin defaults independently and preserves omission', () => {
    expect(categoryCustomsFieldsFromBody({ customsOriginCountry: ' ca ' }, 'product').data).toEqual({ customsOriginCountry: 'CA' });
    expect(categoryCustomsFieldsFromBody({ customsOriginCountry: '' }, 'yarn').data).toEqual({ customsOriginCountry: null });
    expect(categoryCustomsFieldsFromBody({ customsOriginCountry: 'Canada' }, 'product').error).toBeTruthy();
  });
  it('validates category defaults without putting item-level fields into the category', () => {
    expect(categoryCustomsFieldsFromBody({}, 'product').data).toEqual({});
    expect(categoryCustomsFieldsFromBody({ customsProfileKey: '' }, 'product').data).toEqual({ customsProfileKey: null });
    expect(categoryCustomsFieldsFromBody({ customsProfileKey: 'original-hand-painted-art' }, 'product').data).toEqual({ customsProfileKey: 'original-hand-painted-art' });
    expect(categoryCustomsFieldsFromBody({ customsProfileKey: 'acrylic-adult-hat' }, 'yarn').error).toBeTruthy();
  });
  it('uses authoritative profile fields rather than client-supplied codes', () => {
    const profile = CUSTOMS_PROFILES[0];
    expect(customsFieldsFromBody({ customsProfileKey: profile.key, customsHsCode: '123456', customsDescription: 'Wrong' }, { kind: 'product' }).data)
      .toEqual({ customsProfileKey: profile.key, customsHsCode: profile.hsCode, customsDescription: profile.description });
  });
  it('rejects unknown profiles and profiles for another item type', () => {
    expect(customsFieldsFromBody({ customsProfileKey: 'unknown' }, { kind: 'product' }).error).toBeTruthy();
    expect(customsFieldsFromBody({ customsProfileKey: 'acrylic-retail-yarn' }, { kind: 'product' }).error).toBeTruthy();
  });
  it('allows explicit removal of a profile for manual classification', () => {
    expect(customsFieldsFromBody({ customsProfileKey: null, customsHsCode: '6505.00' }).data)
      .toEqual({ customsProfileKey: null, customsHsCode: '650500' });
  });
  it('keeps each profile within provider field limits', () => {
    for (const profile of CUSTOMS_PROFILES) {
      expect(profile.description.length).toBeLessThanOrEqual(100);
      expect(profile.hsCode).toMatch(/^\d{6}$/);
      if (profile.internationalOnly) expect(profile.usHtsCode).toBeNull();
      else expect(profile.usHtsCode).toMatch(/^\d{10}$/);
    }
  });
  it('prepares international customs without claiming a fibre composition or guessing weight and origin', () => {
    const fields = customsFieldsFromBody({ customsProfileKey: 'international-crocheted-scarf', customsDescription: '100 percent wool', customsHsCode: '123456' }, { kind: 'product' }).data;
    expect(fields.customsHsCode).toBe('611710');
    expect(fields.customsDescription).toContain('composition unspecified');
    expect(fields).not.toHaveProperty('customsWeightGrams');
    expect(fields).not.toHaveProperty('customsOriginCountry');
  });
  it('preserves omitted fields and allows clearing fields', () => {
    expect(customsFieldsFromBody({}).data).toEqual({});
    expect(customsFieldsFromBody({ customsHsCode: '' }).data).toEqual({ customsHsCode: null });
  });
  it('normalizes classification and origin without guessing them', () => {
    expect(customsFieldsFromBody({ customsHsCode: '6505.00', customsOriginCountry: 'ca', customsWeightGrams: '100.25' }).data)
      .toEqual({ customsHsCode: '650500', customsOriginCountry: 'CA', customsWeightGrams: 100.25 });
  });
  it.each([
    { customsHsCode: 'abc' }, { customsHsCode: '123' },
    { customsOriginCountry: 'Canada' }, { customsWeightGrams: 0 },
    { customsDescription: 'x'.repeat(101) },
    { customsWeightGrams: 400, packageWeightGrams: 350 },
  ])('rejects invalid customs data %j', (body) => {
    expect(customsFieldsFromBody(body).error).toBeTruthy();
  });
});

import {
  applyCustomerPrefillToEmptyFields,
  applySelectedCustomerPrefill,
  getCustomerContactPrefill,
  getCustomOrderCustomerPrefill,
  shouldApplyCustomerPrefillFromInput,
} from '../../src/utils/customerPrefill.js';

describe('CustomOrder customer prefill', () => {
  it('maps connected customer info to custom order form fields', () => {
    expect(getCustomOrderCustomerPrefill({
      name: 'Alice Client',
      email: 'alice@example.com',
      phone: '5145551212',
      address: '123 rue Test',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H2X 1Y4',
      country: 'CA',
    })).toEqual({
      customerName: 'Alice Client',
      customerEmail: 'alice@example.com',
      customerPhone: '(514)-555-1212',
      address: '123 rue Test',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H2X 1Y4',
      country: 'CA',
    });
  });

  it('maps connected customer info to regular quote and checkout fields', () => {
    expect(getCustomerContactPrefill({
      name: 'Alice Client',
      email: 'alice@example.com',
      phone: '5145551212',
      address: '123 rue Test',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H2X 1Y4',
      country: 'CA',
    })).toEqual({
      name: 'Alice Client',
      email: 'alice@example.com',
      phone: '(514)-555-1212',
      address: '123 rue Test',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H2X 1Y4',
      country: 'CA',
    });
  });

  it('maps latest order contact info to regular quote and checkout fields', () => {
    expect(getCustomerContactPrefill({
      name: 'Alice Client',
      email: 'alice@example.com',
      latestContact: {
        phone: '5145551212',
        address: '123 rue Test',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H2X 1Y4',
        country: 'CA',
      },
    })).toEqual({
      name: 'Alice Client',
      email: 'alice@example.com',
      phone: '(514)-555-1212',
      address: '123 rue Test',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H2X 1Y4',
      country: 'CA',
    });
  });

  it('detects typed prefixes from saved customer info', () => {
    expect(shouldApplyCustomerPrefillFromInput('Ali', 'Alice Client')).toBe(true);
    expect(shouldApplyCustomerPrefillFromInput('514555', '(514)-555-1212')).toBe(true);
    expect(shouldApplyCustomerPrefillFromInput('Bob', 'Alice Client')).toBe(false);
  });

  it('prefills empty fields when selecting a customer suggestion', () => {
    let state = {
      name: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      province: '',
      postalCode: '',
      country: 'CA',
    };
    const prefill = getCustomerContactPrefill({
      name: 'Alice Client',
      email: 'alice@example.com',
      phone: '5145551212',
      address: '123 rue Test',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H2X 1Y4',
      country: 'CA',
    });
    const setState = (updater) => { state = updater(state); };

    applySelectedCustomerPrefill(setState, 'name', 'Alice Client', prefill);

    expect(state).toEqual({
      name: 'Alice Client',
      email: 'alice@example.com',
      phone: '(514)-555-1212',
      address: '123 rue Test',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H2X 1Y4',
      country: 'CA',
    });
  });

  it('automatically prefills empty checkout and quote fields for connected customers', () => {
    let state = {
      name: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      province: '',
      postalCode: '',
      country: 'CA',
    };
    const prefill = getCustomerContactPrefill({
      name: 'Alice Client',
      email: 'alice@example.com',
      phone: '6175551212',
      address: '429 State Rd',
      city: 'Dartmouth',
      province: 'MA',
      postalCode: '02747',
      country: 'US',
    });
    const setState = (updater) => { state = updater(state); };

    applyCustomerPrefillToEmptyFields(setState, prefill);

    expect(state).toEqual({
      name: 'Alice Client',
      email: 'alice@example.com',
      phone: '(617)-555-1212',
      address: '429 State Rd',
      city: 'Dartmouth',
      province: 'MA',
      postalCode: '02747',
      country: 'US',
    });
  });

  it('does not overwrite address fields that were already entered', () => {
    let state = {
      name: '',
      email: '',
      phone: '',
      address: '10 rue locale',
      city: '',
      province: '',
      postalCode: '',
      country: 'CA',
    };
    const prefill = getCustomerContactPrefill({
      name: 'Alice Client',
      email: 'alice@example.com',
      address: '429 State Rd',
      city: 'Dartmouth',
      province: 'MA',
      postalCode: '02747',
      country: 'US',
    });
    const setState = (updater) => { state = updater(state); };

    applyCustomerPrefillToEmptyFields(setState, prefill);

    expect(state).toMatchObject({
      name: 'Alice Client',
      email: 'alice@example.com',
      address: '10 rue locale',
      city: '',
      province: '',
      postalCode: '',
      country: 'CA',
    });
  });
});

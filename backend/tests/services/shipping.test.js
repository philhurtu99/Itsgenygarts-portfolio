import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  buildCustomsDeclaration,
  buildShippingPackage,
  parseShippoRates,
  quoteShipping,
  refreshShippoRateForOrder,
  resetShippoCarrierAccountCache,
  shippoRatesConfigured,
} from '../../src/services/shipping.js';

const ENV_KEYS = [
  'NODE_ENV',
  'SHIPPO_API_TOKEN',
  'SHIPPO_ALLOW_TEST_RATES',
  'SHIPPO_CARRIER',
  'SHIPPO_CARRIER_ACCOUNT_IDS',
  'SHIPPO_RATE_CACHE_MINUTES',
  'SHIPPO_RATE_CACHE_MAX_ENTRIES',
  'SHIPPO_RATE_DAILY_LIMIT',
  'SHIPPING_ORIGIN_NAME',
  'SHIPPING_ORIGIN_COMPANY',
  'SHIPPING_ORIGIN_ADDRESS',
  'SHIPPING_ORIGIN_CITY',
  'SHIPPING_ORIGIN_PROVINCE',
  'SHIPPING_ORIGIN_COUNTRY',
  'SHIPPING_ORIGIN_POSTAL_CODE',
  'SHIPPING_ORIGIN_PHONE',
  'BUSINESS_PHONE',
  'SHIPPING_ORIGIN_EMAIL',
  'SHIPPING_CUSTOMS_SIGNER',
  'SHIPPING_CUSTOMS_TARIFF_NUMBER',
  'SHIPPING_HANDLING_FEE_CAD',
];
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
const originalFetch = global.fetch;

function configureShippo(token = 'shippo_test_example') {
  process.env.SHIPPO_API_TOKEN = token;
  process.env.SHIPPO_CARRIER = 'ups';
  process.env.SHIPPO_CARRIER_ACCOUNT_IDS = 'ups-canada-account';
  process.env.SHIPPING_ORIGIN_NAME = 'Itsgenygarts';
  process.env.SHIPPING_ORIGIN_COMPANY = 'Itsgenygarts';
  process.env.SHIPPING_ORIGIN_ADDRESS = '123 boulevard Saint-Martin';
  process.env.SHIPPING_ORIGIN_CITY = 'Laval';
  process.env.SHIPPING_ORIGIN_PROVINCE = 'QC';
  process.env.SHIPPING_ORIGIN_COUNTRY = 'CA';
  process.env.SHIPPING_ORIGIN_POSTAL_CODE = 'H7M1A1';
  process.env.SHIPPING_ORIGIN_PHONE = '5145555555';
  process.env.SHIPPING_ORIGIN_EMAIL = 'info@example.test';
}

beforeEach(() => {
  ENV_KEYS.forEach((key) => { delete process.env[key]; });
  resetShippoCarrierAccountCache();
});

afterEach(() => {
  ENV_KEYS.forEach((key) => {
    if (originalEnv[key] == null) delete process.env[key];
    else process.env[key] = originalEnv[key];
  });
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('buildShippingPackage', () => {
  it('blocks US quotes before configuration, customs validation or external provider calls', async () => {
    global.fetch = jest.fn();
    await expect(quoteShipping({ items: [], products: [], destination: { country: 'US' }, language: 'en' }))
      .rejects.toMatchObject({ statusCode: 422, message: 'Shipping to the United States is temporarily unavailable.' });
    await expect(refreshShippoRateForOrder({ customerCountry: 'US' })).rejects.toMatchObject({ statusCode: 422 });
    expect(global.fetch).not.toHaveBeenCalled();
  });
  it('combines several packaged products conservatively', () => {
    const packageInfo = buildShippingPackage(
      [{ productId: 1, quantity: 1 }, { productId: 2, quantity: 1 }],
      [
        { id: 1, name: 'Hat', packageWeightGrams: 350, packageLengthCm: 25, packageWidthCm: 20, packageHeightCm: 8 },
        { id: 2, name: 'Bag', packageWeightGrams: 500, packageLengthCm: 30, packageWidthCm: 15, packageHeightCm: 10 },
      ],
    );

    expect(packageInfo).toEqual({
      weightGrams: 850,
      weightKg: 0.85,
      lengthCm: 30,
      widthCm: 20,
      heightCm: 18,
    });
  });

  it('rejects products without packaged dimensions', () => {
    expect(() => buildShippingPackage([{ productId: 1 }], [{ id: 1, name: 'Hat' }]))
      .toThrow(/dimensions d'expédition/);
  });
});

describe('buildCustomsDeclaration', () => {
  it('uses a six-digit scarf code for Germany without inventing fibre percentages and blocks it for the US', () => {
    configureShippo();
    process.env.SHIPPING_CUSTOMS_SIGNER = 'Store Owner';
    const product = { id: 1, name: 'Bandana', price: 25, packageWeightGrams: 35, customsWeightGrams: 30,
      customsOriginCountry: 'CA', customsProfileKey: 'international-crocheted-scarf' };
    expect(buildCustomsDeclaration([{ productId: 1 }], [product], 'DE').items[0])
      .toMatchObject({ tariff_number: '611710', origin_country: 'CA', net_weight: '30', description: expect.stringContaining('composition unspecified') });
    expect(() => buildCustomsDeclaration([{ productId: 1 }], [product], 'US')).toThrow(/temporairement suspendue/);
    expect(() => buildCustomsDeclaration([{ productId: 1 }], [{ ...product, customsWeightGrams: null }], 'DE')).toThrow(/informations douanières/i);
  });
  it('uses the wool-predominant blend profile without declaring pure merino or trusting a supplied code', () => {
    configureShippo();
    process.env.SHIPPING_CUSTOMS_SIGNER = 'Store Owner';
    const product = { id: 1, name: 'Cardigan', price: 25, packageWeightGrams: 100, customsWeightGrams: 95,
      customsOriginCountry: 'CA', customsProfileKey: 'international-wool-blend-pullover', customsHsCode: '611030', customsDescription: '100 percent merino' };
    const item = buildCustomsDeclaration([{ productId: 1, quantity: 2 }], [product], 'DE').items[0];
    expect(item).toMatchObject({ tariff_number: '611011', origin_country: 'CA', net_weight: '190', quantity: 2, value_amount: '50.00' });
    expect(item.description).toContain('blend');
    expect(item.description).not.toMatch(/100|merino/);
    expect(() => buildCustomsDeclaration([{ productId: 1 }], [product], 'US')).toThrow(/temporairement suspendue/);
  });

  it('requires an article classification even when its category has a pure-fibre default', () => {
    configureShippo();
    process.env.SHIPPING_CUSTOMS_SIGNER = 'Store Owner';
    const product = { id: 1, name: 'Bandana', price: 25, packageWeightGrams: 35, customsWeightGrams: 30,
      category: { customsProfileKey: 'cotton-crocheted-scarf', customsOriginCountry: 'CA' } };
    expect(() => buildCustomsDeclaration([{ productId: 1 }], [product], 'US')).toThrow(/informations douanières/i);
    const confirmed = { ...product, customsProfileKey: 'cotton-crocheted-scarf' };
    const item = buildCustomsDeclaration([{ productId: 1 }], [confirmed], 'US').items[0];
    expect(item).toMatchObject({ tariff_number: '6117106010', origin_country: 'CA', net_weight: '30' });
    expect(() => buildCustomsDeclaration([{ productId: 1 }], [{ ...confirmed, customsWeightGrams: null }], 'US')).toThrow(/informations douanières/i);
  });

  it('preserves item-specific manual classification and origin over category defaults', () => {
    configureShippo();
    process.env.SHIPPING_CUSTOMS_SIGNER = 'Store Owner';
    const product = { id: 1, name: 'Bandana', price: 25, packageWeightGrams: 35, customsWeightGrams: 30,
      customsDescription: 'Custom scarf', customsHsCode: '611710', customsOriginCountry: 'FR',
      category: { customsProfileKey: 'cotton-crocheted-scarf', customsOriginCountry: 'CA' } };
    expect(buildCustomsDeclaration([{ productId: 1 }], [product], 'US').items[0])
      .toMatchObject({ tariff_number: '611710', origin_country: 'FR', description: 'Custom scarf' });
  });

  it.each([['cotton-crocheted-scarf', '6117106010'], ['acrylic-crocheted-scarf', '6117102030']])('uses the US scarf classification for %s', (key, code) => {
    configureShippo();
    process.env.SHIPPING_CUSTOMS_SIGNER = 'Store Owner';
    const product = { id: 1, name: 'Bandana', price: 25, packageWeightGrams: 35, customsWeightGrams: 30,
      customsProfileKey: key, customsOriginCountry: 'CA' };
    expect(buildCustomsDeclaration([{ productId: 1 }], [product], 'US').items[0].tariff_number).toBe(code);
    expect(buildCustomsDeclaration([{ productId: 1 }], [product], 'FR').items[0].tariff_number).toBe('611710');
  });
  it.each([['US', '6505006090'], ['FR', '650500']])('selects the profile code for destination %s', (country, code) => {
    configureShippo();
    process.env.SHIPPING_CUSTOMS_SIGNER = 'Store Owner';
    const declaration = buildCustomsDeclaration([{ productId: 1 }], [{
      id: 1, name: 'Bonnet', price: 25, packageWeightGrams: 350, customsWeightGrams: 300,
      customsOriginCountry: 'CA', customsProfileKey: 'acrylic-adult-hat', customsDescription: 'Wrong', customsHsCode: '123456',
    }], country);
    expect(declaration.items[0].tariff_number).toBe(code);
    expect(declaration.items[0].description).toContain('100 percent acrylic');
  });
  it('rejects a removed customs profile rather than silently changing its classification', () => {
    configureShippo();
    process.env.SHIPPING_CUSTOMS_SIGNER = 'Store Owner';
    expect(() => buildCustomsDeclaration([{ productId: 1 }], [{
      id: 1, name: 'Bonnet', price: 25, packageWeightGrams: 350, customsProfileKey: 'removed',
    }], 'US')).toThrow(/revérifié/);
  });
  it('uses item-level descriptions, net weights, origins and classifications', () => {
    configureShippo();
    process.env.SHIPPING_CUSTOMS_SIGNER = 'Store Owner';
    process.env.SHIPPING_CUSTOMS_TARIFF_NUMBER = '630790';

    const declaration = buildCustomsDeclaration(
      [{ productId: 1, quantity: 2 }],
      [{ id: 1, name: 'Bonnet', price: 25, packageWeightGrams: 350,
        customsDescription: 'Crocheted cotton winter hat', customsWeightGrams: 300,
        customsOriginCountry: 'CA', customsHsCode: '650500' }],
    );

    expect(declaration).toEqual(expect.objectContaining({
      contents_type: 'MERCHANDISE',
      non_delivery_option: 'RETURN',
      certify: true,
      certify_signer: 'Store Owner',
      incoterm: 'DDU',
      commercial_invoice: true,
    }));
    expect(declaration.items).toEqual([{
      description: 'Crocheted cotton winter hat',
      quantity: 2,
      net_weight: '600',
      mass_unit: 'g',
      value_amount: '50.00',
      value_currency: 'CAD',
      origin_country: 'CA',
      tariff_number: '650500',
    }]);
  });

  it('requires an explicit customs signer', () => {
    configureShippo();

    expect(() => buildCustomsDeclaration(
      [{ productId: 1, quantity: 1 }],
      [{ id: 1, name: 'Bonnet', price: 25, packageWeightGrams: 350 }],
    )).toThrow(/signataire douanier/i);
  });

  it('never replaces missing item customs data with a global tariff or shipping origin', () => {
    configureShippo();
    process.env.SHIPPING_CUSTOMS_SIGNER = 'Store Owner';
    process.env.SHIPPING_CUSTOMS_TARIFF_NUMBER = '630790';
    expect(() => buildCustomsDeclaration([{ productId: 1 }], [{
      id: 1, name: 'Hat', price: 25, packageWeightGrams: 350,
    }])).toThrow(/informations douanières/i);
  });

  it('keeps different origins and codes for mixed items and excludes packaging', () => {
    configureShippo();
    process.env.SHIPPING_CUSTOMS_SIGNER = 'Store Owner';
    const items = buildCustomsDeclaration([{ productId: 1 }, { productId: 2, quantity: 2 }], [
      { id: 1, name: 'Hat', price: 25, packageWeightGrams: 350, customsDescription: 'Cotton hat', customsWeightGrams: 300, customsOriginCountry: 'CA', customsHsCode: '650500' },
      { id: 2, name: 'Yarn', price: 10, packageWeightGrams: 120, customsDescription: 'Cotton yarn', customsWeightGrams: 100.25, customsOriginCountry: 'IN', customsHsCode: '520710' },
    ]).items;
    expect(items[1]).toMatchObject({ origin_country: 'IN', tariff_number: '520710', net_weight: '200.5', value_amount: '20.00' });
    expect(items[0].net_weight).toBe('300');
  });

  it('rejects net weight larger than packaged weight', () => {
    configureShippo();
    process.env.SHIPPING_CUSTOMS_SIGNER = 'Store Owner';
    expect(() => buildCustomsDeclaration([{ productId: 1 }], [{
      id: 1, name: 'Hat', price: 25, packageWeightGrams: 350,
      customsDescription: 'Cotton hat', customsWeightGrams: 400, customsOriginCountry: 'CA', customsHsCode: '650500',
    }])).toThrow(/poids net dépasse/i);
  });
});

describe('Shippo rates', () => {
  const responseBody = {
    status: 'SUCCESS',
    rates: [
      {
        object_id: 'rate-ground',
        provider: 'Canada Post',
        amount: '17.50',
        currency: 'CAD',
        estimated_days: 3,
        servicelevel: { name: 'Expedited Parcel', token: 'canada_post_expedited_parcel' },
      },
      {
        object_id: 'rate-express',
        provider: 'Canada Post',
        amount: '24.25',
        currency: 'CAD',
        estimated_days: 1,
        servicelevel: { name: 'Xpresspost', token: 'canada_post_xpresspost' },
      },
    ],
  };

  it('normalizes Shippo rates in Canadian dollars', () => {
    expect(parseShippoRates(responseBody, 1.5)).toEqual([
      expect.objectContaining({
        provider: 'SHIPPO',
        serviceCode: 'SHIPPO_CANADA_POST_CANADA_POST_EXPEDITED_PARCEL',
        serviceName: 'Canada Post · Expedited Parcel',
        amountCad: 19,
        trackingIncluded: true,
        estimatedDays: 3,
      }),
      expect.objectContaining({
        serviceCode: 'SHIPPO_CANADA_POST_CANADA_POST_XPRESSPOST',
        amountCad: 25.75,
      }),
    ]);
  });

  it('ignores rates that are not returned in Canadian dollars', () => {
    expect(parseShippoRates({
      rates: [{
        provider: 'USPS',
        amount: '10',
        currency: 'USD',
        servicelevel: { name: 'Priority', token: 'priority' },
      }],
    })).toEqual([]);
  });

  it('requests Shippo rates with packaged dimensions and a residential destination', async () => {
    configureShippo();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => responseBody,
    });

    expect(shippoRatesConfigured()).toBe(true);
    const result = await quoteShipping({
      items: [{ productId: 1 }],
      products: [{
        id: 1,
        name: 'Hat',
        packageWeightGrams: 350,
        packageLengthCm: 25,
        packageWidthCm: 20,
        packageHeightCm: 8,
      }],
      destination: {
        name: 'Alice',
        email: 'alice@example.com',
        phone: '5145555555',
        address: '456 rue Client',
        city: 'Montreal',
        province: 'QC',
        country: 'CA',
        postalCode: 'H2X1Y4',
      },
      language: 'fr',
    });

    expect(result.options).toHaveLength(2);
    expect(global.fetch).toHaveBeenCalledWith('https://api.goshippo.com/shipments/', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'ShippoToken shippo_test_example',
        'SHIPPO-API-VERSION': '2018-02-08',
      }),
    }));
    const request = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(request.address_to).toEqual(expect.objectContaining({
      city: 'Montreal',
      state: 'QC',
      zip: 'H2X1Y4',
      is_residential: true,
    }));
    expect(request.parcels).toEqual([{
      length: '25',
      width: '20',
      height: '8',
      distance_unit: 'cm',
      weight: '350',
      mass_unit: 'g',
    }]);
    expect(request.carrier_accounts).toEqual(['ups-canada-account']);
  });

  it('automatically selects the active UPS account for Canada', async () => {
    configureShippo();
    delete process.env.SHIPPO_CARRIER_ACCOUNT_IDS;
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { object_id: 'ups-us', carrier: 'ups', active: true, metadata: 'US' },
            { object_id: 'ups-ca', carrier: 'ups', active: true, metadata: 'CA' },
          ],
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => responseBody });

    await quoteShipping({
      items: [{ productId: 1 }],
      products: [{
        id: 1,
        name: 'Hat',
        packageWeightGrams: 350,
        packageLengthCm: 25,
        packageWidthCm: 20,
        packageHeightCm: 8,
      }],
      destination: {
        name: 'Alice',
        address: '456 rue Client',
        city: 'Montreal',
        province: 'QC',
        country: 'CA',
        postalCode: 'H2X1Y4',
      },
    });

    expect(global.fetch.mock.calls[0][0]).toContain('/carrier_accounts/');
    const request = JSON.parse(global.fetch.mock.calls[1][1].body);
    expect(request.carrier_accounts).toEqual(['ups-ca']);
  });

  it('adds a customs declaration to an international rate request', async () => {
    configureShippo();
    process.env.SHIPPING_CUSTOMS_SIGNER = 'Store Owner';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => responseBody });

    const result = await quoteShipping({
      items: [{ productId: 1, quantity: 1 }],
      products: [{
        id: 1,
        name: 'Bonnet',
        nameEn: 'Beanie',
        customsDescription: 'Crocheted cotton winter hat',
        customsWeightGrams: 300,
        customsOriginCountry: 'CA',
        customsHsCode: '650500',
        price: 25,
        packageWeightGrams: 350,
        packageLengthCm: 25,
        packageWidthCm: 20,
        packageHeightCm: 8,
      }],
      destination: {
        name: 'Alice',
        email: 'alice@example.com',
        phone: '2125555555',
        address: '123 Broadway',
        city: 'New York',
        province: 'NY',
        country: 'FR',
        postalCode: '10001',
      },
    });

    const request = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(request.customs_declaration).toEqual(expect.objectContaining({
      certify_signer: 'Store Owner',
      contents_type: 'MERCHANDISE',
      items: [expect.objectContaining({ description: 'Crocheted cotton winter hat', net_weight: '300' })],
    }));
    expect(result.package.customsDeclaration).toEqual(request.customs_declaration);
  });

  it('requires sender and recipient phone numbers for international rates', async () => {
    configureShippo();
    process.env.SHIPPING_CUSTOMS_SIGNER = 'Store Owner';
    const quote = {
      items: [{ productId: 1, quantity: 1 }],
      products: [{
        id: 1,
        name: 'Bonnet',
        customsDescription: 'Crocheted cotton winter hat',
        customsWeightGrams: 300,
        customsOriginCountry: 'CA',
        customsHsCode: '650500',
        price: 25,
        packageWeightGrams: 350,
        packageLengthCm: 25,
        packageWidthCm: 20,
        packageHeightCm: 8,
      }],
      destination: {
        name: 'Alice',
        address: '123 Broadway',
        city: 'New York',
        province: 'NY',
        country: 'FR',
        postalCode: '10001',
      },
    };

    await expect(quoteShipping(quote)).rejects.toMatchObject({
      message: expect.stringMatching(/téléphone du destinataire/i),
    });

    quote.destination.phone = '2125555555';
    delete process.env.SHIPPING_ORIGIN_PHONE;
    delete process.env.BUSINESS_PHONE;
    await expect(quoteShipping(quote)).rejects.toMatchObject({
      statusCode: 503,
      message: expect.stringMatching(/téléphone d’expédition/i),
    });
  });

  it('reuses an identical rate quote without another Shippo request', async () => {
    configureShippo();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => responseBody });
    const quote = {
      items: [{ productId: 1 }],
      products: [{
        id: 1,
        name: 'Hat',
        packageWeightGrams: 350,
        packageLengthCm: 25,
        packageWidthCm: 20,
        packageHeightCm: 8,
      }],
      destination: {
        name: 'Alice',
        email: 'alice@example.com',
        phone: '5145555555',
        address: '456 rue Client',
        city: 'Montreal',
        province: 'QC',
        country: 'CA',
        postalCode: 'H2X1Y4',
      },
    };

    const [first, second] = await Promise.all([quoteShipping(quote), quoteShipping(quote)]);

    expect(first).toEqual(second);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('stops new rate requests at the configured daily safety limit', async () => {
    configureShippo();
    process.env.SHIPPO_RATE_DAILY_LIMIT = '1';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => responseBody });
    const baseQuote = {
      items: [{ productId: 1 }],
      products: [{
        id: 1,
        name: 'Hat',
        packageWeightGrams: 350,
        packageLengthCm: 25,
        packageWidthCm: 20,
        packageHeightCm: 8,
      }],
      destination: {
        name: 'Alice',
        email: 'alice@example.com',
        phone: '5145555555',
        address: '456 rue Client',
        city: 'Montreal',
        province: 'QC',
        country: 'CA',
        postalCode: 'H2X1Y4',
      },
    };

    await quoteShipping(baseQuote);
    await expect(quoteShipping({
      ...baseQuote,
      destination: { ...baseQuote.destination, address: '999 autre rue' },
    })).rejects.toMatchObject({ statusCode: 503 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns a temporary service error when Shippo rate-limits the carrier quote', async () => {
    configureShippo();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ERROR', rates: [], messages: [{ text: 'Hard: Too Many Requests' }] }),
    });

    await expect(quoteShipping({
      items: [{ productId: 1 }],
      products: [{ id: 1, name: 'Hat', packageWeightGrams: 350, packageLengthCm: 25, packageWidthCm: 20, packageHeightCm: 8 }],
      destination: { address: '1 Main St', city: 'Montreal', country: 'CA', province: 'QC', postalCode: 'H2X1Y4' },
    })).rejects.toMatchObject({
      statusCode: 503,
      message: expect.stringMatching(/temporairement/i),
    });
  });

  it('blocks test rates in production unless explicitly allowed', () => {
    configureShippo();
    process.env.NODE_ENV = 'production';
    expect(shippoRatesConfigured()).toBe(false);
    process.env.SHIPPO_ALLOW_TEST_RATES = 'true';
    expect(shippoRatesConfigured()).toBe(true);
  });

  it('refreshes the selected Shippo service before purchasing a label', async () => {
    configureShippo();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => responseBody });

    const rate = await refreshShippoRateForOrder({
      shippingProvider: 'SHIPPO',
      shippingServiceCode: 'SHIPPO_CANADA_POST_CANADA_POST_EXPEDITED_PARCEL',
      shippingPackage: { weightGrams: 350, lengthCm: 25, widthCm: 20, heightCm: 8 },
      customerName: 'Alice',
      customerEmail: 'alice@example.com',
      customerPhone: '5145555555',
      customerAddress: '456 rue Client',
      customerCity: 'Montreal',
      customerProvince: 'QC',
      customerCountry: 'CA',
      customerPostalCode: 'H2X1Y4',
    });

    expect(rate).toEqual(expect.objectContaining({ rateId: 'rate-ground' }));
  });

  it('does not fall back to an obsolete shipping integration', async () => {
    await expect(quoteShipping({
      items: [{ productId: 1 }],
      products: [{ id: 1, name: 'Hat', packageWeightGrams: 350, packageLengthCm: 25, packageWidthCm: 20, packageHeightCm: 8 }],
      destination: { country: 'CA', province: 'QC' },
    })).rejects.toMatchObject({ statusCode: 503 });
  });
});

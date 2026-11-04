import dotenv from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { quoteShipping, shippoRatesConfigured } from '../src/services/shipping.js';
import { createShippoShipment, downloadShippoLabel, downloadShippoCommercialInvoice } from '../src/services/shippoLabels.js';

dotenv.config();
const usa = process.argv.includes('--usa');
const label = process.argv.includes('--label');
if ((usa || label) && !String(process.env.SHIPPO_API_TOKEN || '').startsWith('shippo_test_')) {
  throw new Error('Le test USA exige une cle shippo_test_. Aucun appel live ne sera effectue.');
}

const requiredEnv = [
  'SHIPPO_API_TOKEN',
  'SHIPPING_ORIGIN_ADDRESS',
  'SHIPPING_ORIGIN_CITY',
  'SHIPPING_ORIGIN_PROVINCE',
  'SHIPPING_ORIGIN_POSTAL_CODE',
];
const missing = requiredEnv.filter((name) => !String(process.env[name] || '').trim());

if (missing.length > 0 || !shippoRatesConfigured()) {
  console.error(`Configuration Shippo locale incomplète: ${missing.join(', ') || 'clé de test bloquée'}`);
  process.exitCode = 1;
} else {
  const destination = {
    name: 'Test Shippo', phone: '2125555555',
    address: process.env.SHIPPO_TEST_DESTINATION_ADDRESS || (usa ? '123 Broadway' : '275 rue Notre-Dame Est'),
    city: process.env.SHIPPO_TEST_DESTINATION_CITY || (usa ? 'New York' : 'Montreal'),
    province: process.env.SHIPPO_TEST_DESTINATION_PROVINCE || (usa ? 'NY' : 'QC'),
    country: process.env.SHIPPO_TEST_DESTINATION_COUNTRY || (usa ? 'US' : 'CA'),
    postalCode: process.env.SHIPPO_TEST_DESTINATION_POSTAL_CODE || (usa ? '10001' : 'H2Y1C6'),
  };
  const result = await quoteShipping({
    items: [{ productId: 1, quantity: 1 }],
    products: [{
      id: 1,
      name: 'Colis test',
      price: 25,
      customsDescription: 'Hand crocheted acrylic winter hat',
      customsWeightGrams: 300,
      customsOriginCountry: 'CA',
      // Illustrative test classification only; classify real products separately.
      customsHsCode: '650500',
      packageWeightGrams: 350,
      packageLengthCm: 25,
      packageWidthCm: 20,
      packageHeightCm: 8,
    }],
    destination,
    language: 'fr',
  });

  console.table(result.options.map((option) => ({
    transporteur: option.serviceName,
    prixCad: option.amountCad,
    joursOuvrables: option.estimatedDays || '',
    suivi: option.trackingIncluded ? 'oui' : 'non',
  })));

  if (label) {
    const selected = result.options[0];
    if (!selected) throw new Error('Aucun tarif disponible pour le test.');
    const shipment = await createShippoShipment({
      id: `local-test-${Date.now()}`, createdAt: new Date(),
      shippingProvider: 'SHIPPO', shippingRateId: selected.rateId,
      shippingServiceCode: selected.serviceCode, shippingPackage: result.package,
      customerName: destination.name, customerPhone: destination.phone,
      customerAddress: destination.address, customerCity: destination.city,
      customerProvince: destination.province, customerCountry: destination.country,
      customerPostalCode: destination.postalCode,
    });
    const output = new URL('../build/shippo-test/', import.meta.url);
    await mkdir(output, { recursive: true });
    const document = await downloadShippoLabel(shipment.transactionId);
    const labelPath = new URL(`label-${shipment.transactionId}.pdf`, output);
    await writeFile(labelPath, document.data);
    console.log(`Etiquette TEST (non utilisable pour expedier): ${fileURLToPath(labelPath)}`);
    if (destination.country !== 'CA') {
      const invoice = await downloadShippoCommercialInvoice(shipment.transactionId);
      const invoicePath = new URL(`customs-${shipment.transactionId}.pdf`, output);
      await writeFile(invoicePath, invoice.data);
      console.log(`Facture commerciale TEST: ${fileURLToPath(invoicePath)}`);
    }
  }
}

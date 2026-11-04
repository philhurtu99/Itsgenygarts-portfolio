import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// This script adds only fictional records to a dedicated local portfolio database.
const database = new URL(process.env.DATABASE_URL || '');
const localHosts = new Set(['localhost', '127.0.0.1', '[::1]', 'db']);
if (process.env.NODE_ENV === 'production' || !localHosts.has(database.hostname) || !database.pathname.includes('portfolio')) {
  throw new Error('Demo seed requires a local database with "portfolio" in its name and a non-production environment.');
}
if (!process.env.ADMIN_SEED_PASSWORD) throw new Error('Run npm run setup:local first.');

const storefront = new URL(process.env.FRONTEND_URL || 'http://localhost:3000');
if (!localHosts.has(storefront.hostname)) throw new Error('Demo storefront must use a local address.');
const prisma = new PrismaClient();

async function main() {
  const category = await prisma.category.upsert({
    where: { name: 'Collection démonstration' }, update: {},
    create: { name: 'Collection démonstration', nameFr: 'Collection démonstration', nameEn: 'Demo collection', isActive: true },
  });
  const catalogue = [
    { name: 'Bonnet démo', nameEn: 'Demo beanie', price: 35, image: 'bonnet.svg', colors: ['#D97A95', '#B6A0D4'] },
    { name: 'Sac démo', nameEn: 'Demo bag', price: 55, image: 'sac.svg', colors: ['#C3A27F', '#91B8A3'] },
  ];
  for (const item of catalogue) {
    const imageUrl = new URL(`/demo/${item.image}`, storefront).href;
    const data = {
      name: item.name, nameFr: item.name, nameEn: item.nameEn, price: item.price,
      description: 'Produit fictif pour explorer la démonstration locale.',
      descriptionFr: 'Produit fictif pour explorer la démonstration locale.',
      descriptionEn: 'Fictional product for exploring the local demo.',
      mainImageUrl: imageUrl, categoryId: category.id, stockQuantity: 2,
      isFeatured: true, isDraft: false, isDeleted: false,
    };
    const existing = await prisma.product.findFirst({ where: { name: item.name } });
    const product = existing
      ? await prisma.product.update({ where: { id: existing.id }, data })
      : await prisma.product.create({ data });
    if (await prisma.productVariant.count({ where: { productId: product.id } }) === 0) {
      await prisma.productVariant.createMany({ data: item.colors.map((colorHex, sortOrder) => ({ productId: product.id, colorHex, sortOrder, status: 'AVAILABLE' })) });
    }
  }

  const yarnCategory = await prisma.yarnCategory.upsert({
    where: { name: 'Laines de démonstration' }, update: {},
    create: { name: 'Laines de démonstration', nameFr: 'Laines de démonstration', nameEn: 'Demo yarn', isActive: true },
  });
  if (!await prisma.yarnProduct.findFirst({ where: { name: 'Pelote démo' } })) {
    await prisma.yarnProduct.create({ data: {
      name: 'Pelote démo', nameFr: 'Pelote démo', nameEn: 'Demo yarn ball', price: 12,
      description: 'Référence fictive, sans composition douanière réelle.', stockQuantity: 10,
      mainImageUrl: new URL('/demo/pelote.svg', storefront).href, categoryId: yarnCategory.id,
    } });
  }
  await prisma.currencyRate.upsert({ where: { code: 'CAD' }, update: {}, create: { code: 'CAD', symbol: '$', rate: 1 } });
  await prisma.shippingZone.upsert({ where: { name: 'Canada démo' }, update: {}, create: { name: 'Canada démo', countries: 'CA', isActive: true } });

  await prisma.customer.upsert({
    where: { email: 'client@example.test' }, update: {},
    create: {
      name: 'Camille Démo', email: 'client@example.test', preferredLanguage: 'fr',
      emailVerified: true, newsletterConsent: false,
      passwordHash: await bcrypt.hash(process.env.ADMIN_SEED_PASSWORD, 12),
    },
  });
  if (!await prisma.order.findFirst({ where: { customerEmail: 'commande-demo@example.test' } })) {
    await prisma.order.create({ data: {
      customerName: 'Commande de démonstration', customerEmail: 'commande-demo@example.test',
      customerPhone: '+1 514-555-0100', customerAddress: '123 rue Exemple',
      customerCity: 'Ville Démo', customerProvince: 'QC', customerPostalCode: 'A0A 0A0',
      customerCountry: 'CA', customerLanguage: 'fr', currency: 'CAD',
      subtotal: 35, shippingTotal: 0, total: 35, status: 'PREPARING',
      items: { create: [{ productName: 'Bonnet démo', unitPrice: 35, quantity: 1, subtotal: 35 }] },
    } });
  }
  console.log('Fictional catalogue, customer and order ready. No email, payment or shipping API was called.');
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

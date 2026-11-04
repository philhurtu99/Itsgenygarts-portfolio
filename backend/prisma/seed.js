import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminUsername = process.env.ADMIN_SEED_USERNAME || 'admin';
  const adminEmail = process.env.ADMIN_SEED_EMAIL;
  const adminPassword = process.env.ADMIN_SEED_PASSWORD;
  const adminRole = process.env.ADMIN_SEED_ROLE || 'Admin';

  if (!adminEmail || !adminPassword) {
    throw new Error('ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD must be set before running prisma seed.');
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      username: adminUsername,
      passwordHash,
      role: adminRole,
      isActive: true,
    },
    create: {
      username: adminUsername,
      email: adminEmail,
      passwordHash,
      role: adminRole,
      isActive: true,
    },
  });
  console.log(`Admin user seeded: ${adminEmail}`);

  const options = [
    { code: '#1', displayName: 'Model #1' },
    { code: '#2', displayName: 'Model #2' },
    { code: '#3', displayName: 'Model #3' },
    { code: 'OTHER', displayName: 'Other / custom' },
  ];

  for (const option of options) {
    await prisma.customModelOption.upsert({
      where: { code: option.code },
      update: {},
      create: option,
    });
  }

  console.log('Seed completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

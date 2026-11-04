import { PrismaClient } from '@prisma/client';
import { verificationTtlHours as ttlHours } from '../utils/verificationExpiry.js';

const prisma = new PrismaClient();

export async function deleteExpiredUnverifiedCustomers({ olderThanHours = ttlHours() } = {}) {
  const cutoff = new Date(Date.now() - ttlHours(olderThanHours) * 60 * 60 * 1000);
  const result = await prisma.customer.deleteMany({
    where: {
      emailVerified: false,
      verificationToken: { not: null },
      createdAt: { lt: cutoff },
    },
  });

  return result.count;
}

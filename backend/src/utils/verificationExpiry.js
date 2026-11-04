export function verificationTtlHours(value = process.env.UNVERIFIED_CUSTOMER_TTL_HOURS) {
  const hours = Number(value);
  return Number.isFinite(hours) && hours > 0 ? hours : 48;
}

export function verificationExpiresAt(createdAt) {
  return new Date(new Date(createdAt).getTime() + verificationTtlHours() * 60 * 60 * 1000);
}

export function isVerificationExpired(customer) {
  const expires = verificationExpiresAt(customer.createdAt).getTime();
  return !Number.isFinite(expires) || expires <= Date.now();
}

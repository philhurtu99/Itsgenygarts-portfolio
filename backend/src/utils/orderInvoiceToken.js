import jwt from 'jsonwebtoken';
import { publicApiBaseUrl } from './publicApiUrl.js';

const PURPOSE = 'order-invoice-download';
const EXPIRES_IN = '30d';

function secret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required for invoice download tokens');
  }
  return process.env.JWT_SECRET;
}

export function canDownloadInvoice(order) {
  const status = String(order?.status || '').toUpperCase();
  return Boolean(order?.paidAt) || ['PAID', 'PROCESSING', 'PREPARING', 'SHIPPED', 'COMPLETED'].includes(status);
}

export function createOrderInvoiceToken(order) {
  return jwt.sign({
    purpose: PURPOSE,
    orderId: Number(order.id),
    email: String(order.customerEmail || '').trim().toLowerCase(),
  }, secret(), { expiresIn: EXPIRES_IN });
}

export function verifyOrderInvoiceToken(token, orderId) {
  const decoded = jwt.verify(String(token || ''), secret());
  const expectedOrderId = Number(orderId);
  if (
    decoded?.purpose !== PURPOSE
    || Number(decoded.orderId) !== expectedOrderId
    || !decoded.email
  ) {
    throw new Error('Invalid invoice token');
  }
  return {
    orderId: Number(decoded.orderId),
    email: String(decoded.email).trim().toLowerCase(),
  };
}

export function orderInvoiceDownloadUrl(order) {
  const token = createOrderInvoiceToken(order);
  return `${publicApiBaseUrl()}/orders/${Number(order.id)}/invoice?token=${encodeURIComponent(token)}`;
}

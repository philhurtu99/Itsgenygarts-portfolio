import PDFDocument from 'pdfkit';
import { formatPhoneForCountry } from '../utils/phone.js';
import { isEnglish, languageOf } from '../utils/language.js';

const BUSINESS_NAME = process.env.BUSINESS_NAME || 'Itsgenygarts';
const BUSINESS_ADDRESS = process.env.BUSINESS_ADDRESS || '';
const BUSINESS_EMAIL = process.env.BUSINESS_EMAIL || '';
const BUSINESS_PHONE = process.env.BUSINESS_PHONE || '';
const BUSINESS_TAX_ID = process.env.BUSINESS_TAX_ID || '';

function isPaidOrder(order) {
  const status = String(order?.status || '').toUpperCase();
  return Boolean(order?.paidAt) || ['PAID', 'PROCESSING', 'PREPARING', 'SHIPPED', 'COMPLETED'].includes(status);
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function stripeAddressLines(stripeData) {
  const address = stripeData?.customer?.address;
  if (!address) return null;
  return {
    name: stripeData.customer.name,
    email: stripeData.customer.email,
    phone: stripeData.customer.phone,
    line1: address.line1,
    line2: address.line2,
    cityLine: [address.city, address.province, address.postalCode].filter(Boolean).join(', '),
    country: address.country,
  };
}

export function invoiceNumber(order) {
  const year = new Date(order.createdAt).getFullYear();
  return `FACT-${year}-${String(order.id).padStart(6, '0')}`;
}

function invoiceCopy(order) {
  const en = isEnglish(languageOf(order));
  return {
    locale: en ? 'en-CA' : 'fr-CA',
    invoice: en ? 'INVOICE' : 'FACTURE',
    number: en ? 'No.' : 'N°',
    date: en ? 'Date:' : 'Date :',
    order: en ? 'Order:' : 'Commande :',
    stripeInvoice: en ? 'Stripe invoice:' : 'Facture Stripe :',
    stripePayment: en ? 'Stripe payment:' : 'Paiement Stripe :',
    billedTo: en ? 'BILLED TO' : 'FACTURÉ À',
    paymentData: en ? 'Payment data retrieved from' : 'Données de paiement récupérées depuis',
    item: en ? 'Item' : 'Article',
    fallbackItem: en ? 'Item' : 'Article',
    variant: en ? 'Variant' : 'Variation',
    quantity: en ? 'Qty' : 'Qté',
    unitPrice: en ? 'Unit price' : 'Prix unit.',
    total: en ? 'Total' : 'Total',
    subtotal: en ? 'Subtotal' : 'Sous-total',
    shipping: en ? 'Shipping' : 'Livraison',
    discount: en ? 'Discount' : 'Rabais',
    taxes: en ? 'Taxes' : 'Taxes',
    paidOn: en ? 'Paid on' : 'Payé le',
    status: en ? 'Status:' : 'Statut :',
    card: en ? 'Card' : 'Carte',
    method: en ? 'Method:' : 'Méthode :',
    stripeCharge: en ? 'Stripe charge:' : 'Charge Stripe :',
    stripeReceiptAvailable: en ? 'Stripe receipt available' : 'Reçu Stripe disponible',
    thanks: en ? `Thank you for your trust - ${BUSINESS_NAME}` : `Merci pour votre confiance — ${BUSINESS_NAME}`,
  };
}

function invoiceItemName(item, labels) {
  const name = item.productName || item.description || item.name || labels.fallbackItem;
  return item.variantLabelSnapshot
    ? `${name} - ${labels.variant} ${item.variantLabelSnapshot}`
    : name;
}

function invoiceItemImageUrl(item, index, orderItems = []) {
  const fallbackOrderItem = orderItems[index] || {};
  return item?.productImageUrl
    || item?.imageUrl
    || item?.images?.[0]
    || fallbackOrderItem.productImageUrl
    || fallbackOrderItem.imageUrl
    || fallbackOrderItem.images?.[0]
    || null;
}

async function fetchImageBuffer(url) {
  if (!url || typeof fetch !== 'function') return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType && !contentType.toLowerCase().startsWith('image/')) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

// Returns a Buffer containing the PDF.
export async function generateInvoicePDF(order, stripeData = null) {
  const orderItems = order.items || [];
  const invoiceItems = stripeData?.lineItems?.length ? stripeData.lineItems : orderItems;
  const itemImageBuffers = await Promise.all(
    invoiceItems.map((item, index) => fetchImageBuffer(invoiceItemImageUrl(item, index, orderItems))),
  );

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const currency = stripeData?.currency || order.currency || 'CAD';
      const labels = invoiceCopy(order);
      const fmt = (n) => `${Number(n).toFixed(2)} ${currency}`;
      const invNum = invoiceNumber(order);
      const paidAt = stripeData?.paidAt || order.paidAt;
      const date = new Date(paidAt || order.createdAt).toLocaleDateString(labels.locale);
      const billedTo = stripeAddressLines(stripeData);
      const subtotal = firstDefined(stripeData?.subtotal, order.subtotal, 0);
      const shipping = firstDefined(stripeData?.shipping, order.shippingTotal, 0);
      const tax = firstDefined(stripeData?.tax, null);
      const discount = firstDefined(stripeData?.discount, null);
      const total = firstDefined(stripeData?.total, order.total, 0);

      // Header
      doc.fontSize(22).font('Helvetica-Bold').text(BUSINESS_NAME, 50, 50);
      doc.fontSize(9).font('Helvetica').fillColor('#666');
      if (BUSINESS_ADDRESS) doc.text(BUSINESS_ADDRESS, 50, 80);
      if (BUSINESS_EMAIL) doc.text(BUSINESS_EMAIL, 50, doc.y);
      if (BUSINESS_PHONE) doc.text(formatPhoneForCountry(BUSINESS_PHONE, 'CA'), 50, doc.y);
      if (BUSINESS_TAX_ID) doc.text(BUSINESS_TAX_ID, 50, doc.y);

      // Invoice title + number (right side)
      doc.fontSize(24).font('Helvetica-Bold').fillColor('#000').text(labels.invoice, 400, 50, { align: 'right' });
      doc.fontSize(10).font('Helvetica').fillColor('#666');
      doc.text(`${labels.number} ${invNum}`, 400, 80, { align: 'right' });
      doc.text(`${labels.date} ${date}`, 400, doc.y, { align: 'right' });
      doc.text(`${labels.order} #${order.id}`, 400, doc.y, { align: 'right' });
      if (stripeData?.invoiceId) doc.text(`${labels.stripeInvoice} ${stripeData.invoiceId}`, 400, doc.y, { align: 'right' });
      if (stripeData?.paymentIntentId) doc.text(`${labels.stripePayment} ${stripeData.paymentIntentId}`, 400, doc.y, { align: 'right' });

      // Divider
      doc.moveTo(50, 150).lineTo(545, 150).strokeColor('#ddd').stroke();

      // Billed to
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000').text(labels.billedTo, 50, 170);
      doc.fontSize(10).font('Helvetica').fillColor('#333');
      doc.text(billedTo?.name || order.customerName, 50, doc.y + 4);
      if (billedTo?.email || order.customerEmail) doc.text(billedTo?.email || order.customerEmail);
      if (billedTo?.phone || order.customerPhone) doc.text(formatPhoneForCountry(billedTo?.phone || order.customerPhone, order.customerCountry));
      doc.text(billedTo?.line1 || order.customerAddress);
      if (billedTo?.line2) doc.text(billedTo.line2);
      doc.text(billedTo?.cityLine || [order.customerCity, order.customerProvince, order.customerPostalCode].filter(Boolean).join(', '));
      doc.text(billedTo?.country || order.customerCountry);

      if (stripeData?.provider) {
        doc.fontSize(9).fillColor('#666');
        doc.text(`${labels.paymentData} ${stripeData.provider}.`, 50, doc.y + 10, { width: 260 });
      }

      // Items table
      let y = Math.max(doc.y + 30, 290);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000');

      // Table header
      doc.rect(50, y, 495, 20).fillAndStroke('#f5f5f5', '#ddd');
      doc.fillColor('#000');
      doc.text(labels.item, 60, y + 6, { width: 240 });
      doc.text(labels.quantity, 310, y + 6, { width: 40, align: 'center' });
      doc.text(labels.unitPrice, 360, y + 6, { width: 80, align: 'right' });
      doc.text(labels.total, 450, y + 6, { width: 85, align: 'right' });
      y += 25;

      doc.font('Helvetica').fillColor('#333');
      for (const [index, item] of invoiceItems.entries()) {
        if (y > 720) {
          doc.addPage();
          y = 50;
        }
        const imageBuffer = itemImageBuffers[index];
        const rowHeight = imageBuffer ? 54 : 22;
        if (imageBuffer) {
          try {
            doc.image(imageBuffer, 60, y, { fit: [42, 42] });
          } catch {
            // Keep the invoice downloadable even if an image cannot be embedded.
          }
        }
        doc.text(invoiceItemName(item, labels), imageBuffer ? 112 : 60, y + (imageBuffer ? 6 : 0), { width: imageBuffer ? 188 : 240 });
        doc.text(String(item.quantity), 310, y + 6, { width: 40, align: 'center' });
        doc.text(fmt(item.unitPrice), 360, y + 6, { width: 80, align: 'right' });
        doc.text(fmt(item.subtotal), 450, y + 6, { width: 85, align: 'right' });
        y += rowHeight;
      }

      // Totals
      y += 10;
      doc.moveTo(350, y).lineTo(545, y).strokeColor('#ddd').stroke();
      y += 10;

      doc.fontSize(10).font('Helvetica');
      doc.text(labels.subtotal, 350, y, { width: 100, align: 'right' });
      doc.text(fmt(subtotal), 450, y, { width: 85, align: 'right' });
      y += 18;

      if (Number(shipping) > 0) {
        doc.text(labels.shipping, 350, y, { width: 100, align: 'right' });
        doc.text(fmt(shipping), 450, y, { width: 85, align: 'right' });
        y += 18;
      }

      if (Number(discount) > 0) {
        doc.text(labels.discount, 350, y, { width: 100, align: 'right' });
        doc.text(`-${fmt(discount)}`, 450, y, { width: 85, align: 'right' });
        y += 18;
      }

      if (Number(tax) > 0) {
        doc.text(labels.taxes, 350, y, { width: 100, align: 'right' });
        doc.text(fmt(tax), 450, y, { width: 85, align: 'right' });
        y += 18;
      }

      doc.font('Helvetica-Bold').fontSize(12).fillColor('#000');
      doc.text(labels.total.toUpperCase(), 350, y, { width: 100, align: 'right' });
      doc.text(fmt(total), 450, y, { width: 85, align: 'right' });
      y += 30;

      // Payment info
      doc.fontSize(9).font('Helvetica').fillColor('#666');
      if (isPaidOrder(order)) {
        doc.fillColor('#166534').text(`${labels.paidOn} ${new Date(paidAt || order.createdAt).toLocaleDateString(labels.locale)}`, 50, y);
      } else {
        doc.text(`${labels.status} ${order.status}`, 50, y);
      }
      y += 20;

      if (stripeData?.paymentMethod) {
        const method = stripeData.paymentMethod.type === 'card'
          ? `${labels.card} ${stripeData.paymentMethod.brand || ''} •••• ${stripeData.paymentMethod.last4 || ''}`.trim()
          : `${labels.method} ${stripeData.paymentMethod.type}`;
        doc.fillColor('#666').text(method, 50, y, { width: 495 });
        y += 12;
      }
      if (stripeData?.chargeId) {
        doc.text(`${labels.stripeCharge} ${stripeData.chargeId}`, 50, y, { width: 495 });
        y += 12;
      }
      if (stripeData?.receiptUrl) {
        doc.fillColor('#666').text(labels.stripeReceiptAvailable, 50, y, {
          width: 495,
          link: stripeData.receiptUrl,
          underline: true,
        });
        y += 12;
      }

      doc.fillColor('#888').fontSize(8);
      doc.text(labels.thanks, 50, y, { width: 495 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { formatPhoneForCountry } from '../utils/phone.js';
import { isEnglish, languageOf } from '../utils/language.js';

const BUSINESS_NAME = process.env.BUSINESS_NAME || 'Itsgenygarts';
const BUSINESS_ADDRESS = process.env.BUSINESS_ADDRESS || '';
const BUSINESS_EMAIL = process.env.BUSINESS_EMAIL || 'info@example.test';
const BUSINESS_PHONE = process.env.BUSINESS_PHONE || '';

function paymentDate(payment, order) {
  return payment?.paidAt || payment?.createdAt || order?.paidAt || order?.createdAtUtc || new Date();
}

export function customPaymentInvoiceNumber(order, payment) {
  const year = new Date(paymentDate(payment, order)).getFullYear();
  const paymentId = Number.isInteger(Number(payment?.id)) ? String(payment.id).padStart(3, '0') : 'FINAL';
  return `FACT-CUSTOM-${year}-${String(order.id).padStart(6, '0')}-${paymentId}`;
}

export function finalProductImageUrl(order) {
  const finalImages = (order?.images || [])
    .filter((image) => image?.purpose === 'FINAL_PRODUCT' && image.storagePathOrUrl)
    .sort((a, b) => new Date(b.uploadedAtUtc || 0) - new Date(a.uploadedAtUtc || 0));
  return finalImages[0]?.storagePathOrUrl || null;
}

async function fetchImageBuffer(url) {
  if (!url || typeof fetch !== 'function') return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType && !contentType.toLowerCase().startsWith('image/')) return null;
    const source = Buffer.from(await response.arrayBuffer());
    return sharp(source)
      .rotate()
      .flatten({ background: '#FFFFFF' })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
  } catch {
    return null;
  }
}

function paymentMethodLabel(method, en) {
  return ({
    CASH: en ? 'Cash' : 'Comptant',
    E_TRANSFER: en ? 'Interac e-transfer' : 'Virement Interac',
    TAP_TO_PAY: 'Tap to Pay',
    STRIPE_LINK: en ? 'Stripe payment link' : 'Lien de paiement Stripe',
    STRIPE_MANUAL: en ? 'Manual Stripe payment' : 'Paiement Stripe manuel',
  })[method] || (en ? 'Payment' : 'Paiement');
}

function copyFor(order) {
  const en = isEnglish(languageOf(order));
  return {
    en,
    locale: en ? 'en-CA' : 'fr-CA',
    invoice: en ? 'PAYMENT INVOICE' : 'FACTURE DE PAIEMENT',
    number: en ? 'No.' : 'N°',
    date: en ? 'Date:' : 'Date :',
    customOrder: en ? 'Custom order:' : 'Commande sur mesure :',
    billedTo: en ? 'BILLED TO' : 'FACTURÉ À',
    project: en ? 'PROJECT' : 'PROJET',
    description: en ? 'Description' : 'Description',
    paymentMethod: en ? 'Payment method' : 'Méthode de paiement',
    totalPrice: en ? 'Project total' : 'Total du projet',
    paymentReceived: en ? 'Payment received' : 'Paiement reçu',
    paidToDate: en ? 'Paid to date' : 'Payé à ce jour',
    balance: en ? 'Balance due' : 'Solde restant',
    paidInFull: en ? 'PAID IN FULL' : 'PAYÉ EN TOTALITÉ',
    partial: en ? 'PARTIALLY PAID' : 'PARTIELLEMENT PAYÉ',
    finalProduct: en ? 'Finished product' : 'Produit terminé',
    thanks: en ? `Thank you for your trust - ${BUSINESS_NAME}` : `Merci pour votre confiance - ${BUSINESS_NAME}`,
  };
}

export async function generateCustomPaymentInvoicePDF(order, payment) {
  const labels = copyFor(order);
  const total = Math.max(0, Number(order?.price || 0));
  const paid = Math.min(total, Math.max(0, Number(order?.amountPaid || 0)));
  const balance = Math.max(0, Math.round((total - paid) * 100) / 100);
  const amount = Math.max(0, Number(payment?.amount || 0));
  const isFinalPayment = balance <= 0.001;
  const finalImageBuffer = isFinalPayment
    ? await fetchImageBuffer(finalProductImageUrl(order))
    : null;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const invoiceNumber = customPaymentInvoiceNumber(order, payment);
      const date = new Date(paymentDate(payment, order)).toLocaleString(labels.locale, {
        timeZone: 'America/Toronto',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      const money = (value) => `${Number(value || 0).toFixed(2)} CAD`;

      doc.fontSize(22).font('Helvetica-Bold').fillColor('#2C2018').text(BUSINESS_NAME, 50, 50);
      doc.fontSize(9).font('Helvetica').fillColor('#6F625B');
      if (BUSINESS_ADDRESS) doc.text(BUSINESS_ADDRESS, 50, 80);
      if (BUSINESS_EMAIL) doc.text(BUSINESS_EMAIL, 50, doc.y);
      if (BUSINESS_PHONE) doc.text(formatPhoneForCountry(BUSINESS_PHONE, 'CA'), 50, doc.y);

      doc.fontSize(20).font('Helvetica-Bold').fillColor('#DD7A8F').text(labels.invoice, 310, 50, { width: 235, align: 'right' });
      doc.fontSize(9).font('Helvetica').fillColor('#6F625B');
      doc.text(`${labels.number} ${invoiceNumber}`, 310, 80, { width: 235, align: 'right' });
      doc.text(`${labels.date} ${date}`, 310, doc.y, { width: 235, align: 'right' });
      doc.text(`${labels.customOrder} #${order.id}`, 310, doc.y, { width: 235, align: 'right' });

      doc.moveTo(50, 145).lineTo(545, 145).strokeColor('#E8D9D4').stroke();

      doc.fontSize(10).font('Helvetica-Bold').fillColor('#2C2018').text(labels.billedTo, 50, 165);
      doc.fontSize(10).font('Helvetica').fillColor('#493D37');
      doc.text(order.customerName || '-', 50, doc.y + 5);
      doc.text(order.customerEmail || '-');
      if (order.customerPhone) doc.text(formatPhoneForCountry(order.customerPhone, order.customerCountry));

      doc.fontSize(10).font('Helvetica-Bold').fillColor('#2C2018').text(labels.project, 310, 165, { width: 235 });
      doc.fontSize(11).font('Helvetica-Bold').text(order.category || (labels.en ? 'Custom order' : 'Commande sur mesure'), 310, doc.y + 5, { width: 235 });
      if (order.description) {
        doc.fontSize(8).font('Helvetica').fillColor('#6F625B').text(`${labels.description}: ${order.description}`, 310, doc.y + 4, { width: 235, height: 42, ellipsis: true });
      }

      let y = Math.max(doc.y + 28, 260);
      if (finalImageBuffer) {
        doc.roundedRect(50, y, 495, 150, 6).strokeColor('#E8D9D4').stroke();
        try {
          doc.image(finalImageBuffer, 62, y + 12, { fit: [126, 126], align: 'center', valign: 'center' });
        } catch {
          // The payment invoice remains valid if the remote image cannot be decoded.
        }
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#2C2018').text(labels.finalProduct, 210, y + 25, { width: 315 });
        doc.fontSize(9).font('Helvetica').fillColor('#6F625B').text(order.category || '', 210, y + 48, { width: 315 });
        y += 170;
      }

      doc.roundedRect(50, y, 495, 154, 6).fillAndStroke('#FFF8FA', '#F1D6DD');
      const rows = [
        [labels.totalPrice, money(total), false],
        [labels.paymentReceived, money(amount), true],
        [labels.paidToDate, money(paid), false],
        [labels.balance, money(balance), false],
      ];
      let rowY = y + 18;
      rows.forEach(([label, value, highlight]) => {
        doc.fontSize(10).font(highlight ? 'Helvetica-Bold' : 'Helvetica').fillColor(highlight ? '#B84F68' : '#493D37');
        doc.text(label, 68, rowY, { width: 275 });
        doc.text(value, 360, rowY, { width: 165, align: 'right' });
        rowY += 27;
      });

      y += 174;
      doc.fontSize(9).font('Helvetica').fillColor('#6F625B').text(
        `${labels.paymentMethod}: ${paymentMethodLabel(payment?.method, labels.en)}`,
        50,
        y,
        { width: 495 },
      );
      y += 24;
      doc.fontSize(11).font('Helvetica-Bold').fillColor(isFinalPayment ? '#166534' : '#9A6700').text(
        isFinalPayment ? labels.paidInFull : labels.partial,
        50,
        y,
        { width: 495 },
      );
      y += 32;
      doc.fontSize(8).font('Helvetica').fillColor('#8A7A6A').text(labels.thanks, 50, y, { width: 495 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

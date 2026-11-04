import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { requireAdmin } from '../../middleware/auth.js';
import { sendEmail } from '../../services/email.js';
import { emailBox, emailButton, emailHtml, emailTextBlock } from '../../utils/emailTemplate.js';
import { isEnglish, languageOf } from '../../utils/language.js';
import { protectPrivateMedia } from '../../utils/privateMedia.js';

const router = Router();
const prisma = new PrismaClient();
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

router.use(requireAdmin);

const ALLOWED_STATUSES = ['NEW', 'DISCUSSING', 'AWAITING_PAYMENT', 'PAID', 'IN_PRODUCTION', 'SHIPPED', 'COMPLETED'];

router.get('/', async (req, res, next) => {
  try {
    const quotes = await prisma.personalizedQuote.findMany({
      orderBy: { createdAtUtc: 'desc' },
      include: { images: true },
    });
    res.json({ success: true, data: protectPrivateMedia(quotes) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const quote = await prisma.personalizedQuote.findUnique({
      where: { id: Number(req.params.id) },
      include: { images: true },
    });
    if (!quote) return res.status(404).json({ success: false, message: 'Devis introuvable' });
    res.json({ success: true, data: protectPrivateMedia(quote) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/send-email', async (req, res, next) => {
  try {
    const { subject, body, price } = req.body;
    if (!subject?.trim() || !body?.trim()) {
      return res.status(400).json({ success: false, message: 'Objet et corps du message requis' });
    }

    const quote = await prisma.personalizedQuote.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!quote) return res.status(404).json({ success: false, message: 'Devis introuvable' });

    let emailText = body.trim();
    let paymentUrl = null;
    const lang = languageOf(quote);
    const en = isEnglish(lang);

    if (price && Number(price) > 0 && stripe) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: quote.customerEmail,
        line_items: [{
          price_data: {
            currency: 'cad',
            product_data: { name: `${en ? 'Personalized quote' : 'Devis personnalisé'} #${quote.id}` },
            unit_amount: Math.round(Number(price) * 100),
          },
          quantity: 1,
        }],
        metadata: { personalizedQuoteId: String(quote.id) },
        success_url: `${frontendUrl}/order-confirmation?type=quote&id=${quote.id}`,
        cancel_url: `${frontendUrl}`,
      });

      paymentUrl = session.url;
      emailText += en
        ? `\n\n---\nAmount: ${Number(price).toFixed(2)} $ CAD\nPay here: ${session.url}`
        : `\n\n---\nMontant : ${Number(price).toFixed(2)} $ CAD\nCliquez ici pour payer : ${session.url}`;

      await prisma.personalizedQuote.update({
        where: { id: quote.id },
        data: { price: Number(price), status: 'AWAITING_PAYMENT', stripeSessionId: session.id },
      });
    }

    await sendEmail({
      to: quote.customerEmail,
      profile: 'business',
      lang,
      subject: subject.trim(),
      text: emailText,
      html: emailHtml({
        lang,
        title: subject.trim(),
        recipientEmail: quote.customerEmail,
        content: [
          emailTextBlock(body.trim()),
          paymentUrl
            ? emailBox(`<strong>${en ? 'Amount:' : 'Montant :'}</strong> ${Number(price).toFixed(2)} $ CAD`) + emailButton(en ? 'Pay my quote' : 'Payer mon devis', paymentUrl)
            : '',
        ].join(''),
      }),
    });

    res.json({ success: true, message: `Courriel envoyé à ${quote.customerEmail}`, paymentUrl });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: `Statut invalide. Valeurs acceptées: ${ALLOWED_STATUSES.join(', ')}` });
    }
    const quote = await prisma.personalizedQuote.update({
      where: { id: Number(req.params.id) },
      data: { status },
      include: { images: true },
    });
    res.json({ success: true, data: protectPrivateMedia(quote) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/price', async (req, res, next) => {
  try {
    const price = Number(req.body.price);
    if (!price || price <= 0) {
      return res.status(400).json({ success: false, message: 'Prix invalide' });
    }
    const quote = await prisma.personalizedQuote.update({
      where: { id: Number(req.params.id) },
      data: { price },
      include: { images: true },
    });
    res.json({ success: true, data: protectPrivateMedia(quote) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/send-payment-link', async (req, res, next) => {
  try {
    if (!stripe) {
      return res.status(500).json({ success: false, message: 'Stripe non configuré' });
    }

    const quote = await prisma.personalizedQuote.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!quote) return res.status(404).json({ success: false, message: 'Devis introuvable' });

    const price = Number(quote.price);
    if (!price || price <= 0) {
      return res.status(400).json({ success: false, message: 'Définir un prix avant d\'envoyer le lien de paiement' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const lang = languageOf(quote);
    const en = isEnglish(lang);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: quote.customerEmail,
      line_items: [{
        price_data: {
          currency: 'cad',
          product_data: { name: `${en ? 'Personalized quote' : 'Devis personnalisé'} #${quote.id}` },
          unit_amount: Math.round(price * 100),
        },
        quantity: 1,
      }],
      metadata: {
        personalizedQuoteId: String(quote.id),
      },
      payment_intent_data: {
        metadata: { personalizedQuoteId: String(quote.id) },
      },
      success_url: `${frontendUrl}/order-confirmation?type=quote&id=${quote.id}`,
      cancel_url: `${frontendUrl}`,
    });

    await prisma.personalizedQuote.update({
      where: { id: quote.id },
      data: { status: 'AWAITING_PAYMENT', stripeSessionId: session.id },
    });

    await sendEmail({
      to: quote.customerEmail,
      profile: 'system',
      lang,
      subject: en ? `Payment for your quote #${quote.id}` : `Paiement pour votre devis #${quote.id}`,
      text: en
        ? `Hello ${quote.customerName},\n\nYour quote is ready for payment.\n\nAmount: ${price.toFixed(2)} $ CAD\n\nPay here: ${session.url}\n\nThank you.`
        : `Bonjour ${quote.customerName},\n\nVotre devis est prêt pour le paiement.\n\nMontant : ${price.toFixed(2)} $ CAD\n\nCliquez ici pour payer : ${session.url}\n\nMerci!`,
      html: emailHtml({
        lang,
        title: en ? `Payment for your quote #${quote.id}` : `Paiement pour votre devis #${quote.id}`,
        recipientEmail: quote.customerEmail,
        content: en
          ? `
          <p>Hello <strong>${quote.customerName}</strong>,</p>
          <p>Your quote is ready for payment.</p>
          ${emailBox(`<strong>Amount:</strong> ${price.toFixed(2)} $ CAD`)}
          ${emailButton('Pay my quote', session.url)}
          <p>Thank you.</p>
        `
          : `
          <p>Bonjour <strong>${quote.customerName}</strong>,</p>
          <p>Votre devis est prêt pour le paiement.</p>
          ${emailBox(`<strong>Montant :</strong> ${price.toFixed(2)} $ CAD`)}
          ${emailButton('Payer mon devis', session.url)}
          <p>Merci !</p>
        `,
      }),
    });

    res.json({ success: true, data: { checkoutUrl: session.url } });
  } catch (err) {
    next(err);
  }
});

export default router;

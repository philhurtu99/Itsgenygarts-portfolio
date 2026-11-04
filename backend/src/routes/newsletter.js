import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyNewsletterUnsubscribeToken } from '../utils/newsletterUnsubscribe.js';

const router = Router();
const prisma = new PrismaClient();

function responsePage({ title, message }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#FFFAF0;font-family:Arial,Helvetica,sans-serif;color:#2C2018;">
  <main style="width:min(520px,calc(100% - 32px));background:#fff;border:1px solid #F1D6DD;border-radius:18px;padding:30px;box-shadow:0 10px 30px rgba(44,32,24,0.10);">
    <p style="margin:0 0 6px;color:#C4607A;font-size:12px;letter-spacing:1.8px;text-transform:uppercase;font-weight:800;">Itsgenygarts</p>
    <h1 style="margin:0 0 12px;font-size:26px;line-height:1.15;">${title}</h1>
    <p style="margin:0;color:#8A7A6A;line-height:1.6;">${message}</p>
  </main>
</body>
</html>`;
}

async function unsubscribe(req, res) {
  try {
    const token = String(req.query.token || '');
    const email = verifyNewsletterUnsubscribeToken(token);

    await prisma.customer.updateMany({
      where: { email },
      data: { newsletterConsent: false },
    });

    res
      .status(200)
      .type('html')
      .send(responsePage({
        title: 'Désabonnement confirmé',
        message: 'Vous ne recevrez plus nos infolettres. Vous continuerez toutefois à recevoir les courriels importants liés à vos commandes, devis, paiements ou compte.',
      }));
  } catch (err) {
    res
      .status(400)
      .type('html')
      .send(responsePage({
        title: 'Lien invalide',
        message: 'Le lien de désabonnement est invalide. Répondez à notre courriel si vous voulez que nous ajustions vos préférences.',
      }));
  }
}

router.get('/unsubscribe', unsubscribe);
router.post('/unsubscribe', unsubscribe);

export default router;

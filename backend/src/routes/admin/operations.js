import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAdmin } from '../../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAdmin);

function money(value) {
  if (value === null || value === undefined) return 0;
  return Number(value) || 0;
}

function event(label, at, meta = {}) {
  return { label, at, ...meta };
}

router.get('/timeline/:type/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const type = req.params.type;
    let record = null;
    let events = [];

    if (type === 'order') {
      record = await prisma.order.findUnique({ where: { id }, include: { items: true } });
      if (record) {
        events = [
          event('Commande créée', record.createdAt, { status: 'PENDING' }),
          record.paidAt && event('Paiement reçu', record.paidAt, { status: 'PAID', amount: money(record.total), currency: record.currency }),
          record.status === 'PREPARING' && event('Commande en préparation', record.updatedAt, { status: record.status }),
          record.status === 'SHIPPED' && event('Commande expédiée', record.updatedAt, { status: record.status }),
          record.status === 'COMPLETED' && event('Commande terminée', record.updatedAt, { status: record.status }),
          record.status === 'CANCELLED' && event('Commande annulée', record.updatedAt, { status: record.status }),
        ].filter(Boolean);
      }
    } else if (type === 'customOrder') {
      record = await prisma.customOrder.findUnique({ where: { id } });
      if (record) {
        events = [
          event('Demande sur mesure créée', record.createdAtUtc, { status: 'NEW' }),
          record.stripeSessionId && event('Lien de paiement créé', record.createdAtUtc, { stripeSessionId: record.stripeSessionId }),
          record.paidAt && event('Paiement reçu', record.paidAt, { status: 'PAID', amount: money(record.price), currency: 'CAD' }),
          ['SHIPPED', 'COMPLETED'].includes(record.status) && event('Commande finalisée', record.paidAt || record.createdAtUtc, { status: record.status }),
        ].filter(Boolean);
      }
    } else if (type === 'personalizedQuote') {
      record = await prisma.personalizedQuote.findUnique({ where: { id } });
      if (record) {
        events = [
          event('Devis créé', record.createdAtUtc, { status: 'NEW' }),
          record.stripeSessionId && event('Lien de paiement créé', record.createdAtUtc, { stripeSessionId: record.stripeSessionId }),
          record.paidAt && event('Paiement reçu', record.paidAt, { status: 'PAID', amount: money(record.price), currency: 'CAD' }),
          ['SHIPPED', 'COMPLETED'].includes(record.status) && event('Devis finalisé', record.paidAt || record.createdAtUtc, { status: record.status }),
        ].filter(Boolean);
      }
    } else if (type === 'quoteRequest') {
      record = await prisma.quoteRequest.findUnique({ where: { id }, include: { items: true } });
      if (record) {
        events = [
          event('Demande de panier devis créée', record.createdAt, { status: record.status }),
          record.completedAt && event('Devis complété', record.completedAt, { status: 'Completed' }),
        ].filter(Boolean);
      }
    }

    if (!record) return res.status(404).json({ success: false, message: 'Élément introuvable' });

    const notes = await prisma.adminNote.findMany({
      where: { entityType: type, entityId: id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: {
        events: events.sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0)),
        notes,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;

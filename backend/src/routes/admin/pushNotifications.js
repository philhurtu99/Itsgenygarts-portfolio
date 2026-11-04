import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAdmin } from '../../middleware/auth.js';
import { sendAdminPushNotification } from '../../services/adminPushNotifications.js';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAdmin);

router.post('/register', async (req, res, next) => {
  try {
    const { token, platform, deviceName, appVersion } = req.body || {};
    const pushToken = String(token || '').trim();
    if (!pushToken) {
      return res.status(400).json({ success: false, message: 'Push token required' });
    }

    const saved = await prisma.adminPushToken.upsert({
      where: { token: pushToken },
      update: {
        userId: req.user.id,
        platform: platform ? String(platform).slice(0, 40) : null,
        deviceName: deviceName ? String(deviceName).slice(0, 120) : null,
        appVersion: appVersion ? String(appVersion).slice(0, 40) : null,
        isActive: true,
        lastSeenAt: new Date(),
      },
      create: {
        userId: req.user.id,
        token: pushToken,
        platform: platform ? String(platform).slice(0, 40) : null,
        deviceName: deviceName ? String(deviceName).slice(0, 120) : null,
        appVersion: appVersion ? String(appVersion).slice(0, 40) : null,
      },
    });

    res.json({ success: true, data: { id: saved.id, registered: true } });
  } catch (err) {
    next(err);
  }
});

router.post('/unregister', async (req, res, next) => {
  try {
    const pushToken = String(req.body?.token || '').trim();
    if (!pushToken) {
      return res.json({ success: true, data: { unregistered: false } });
    }

    await prisma.adminPushToken.updateMany({
      where: { token: pushToken },
      data: { isActive: false, lastSeenAt: new Date() },
    });

    res.json({ success: true, data: { unregistered: true } });
  } catch (err) {
    next(err);
  }
});

router.post('/test', async (req, res, next) => {
  try {
    const result = await sendAdminPushNotification(prisma, {
      title: 'Itsgenygarts Admin',
      body: 'Les notifications push sont bien connectées.',
      data: { type: 'test', path: '/' },
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;

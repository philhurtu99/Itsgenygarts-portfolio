import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { requireAdmin } from '../../middleware/auth.js';
import { sendEmail } from '../../services/email.js';
import { emailEscape, emailHtml, emailTextBlock } from '../../utils/emailTemplate.js';
import { validate } from '../../middleware/validate.js';
import { isEnglish, languageOf } from '../../utils/language.js';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAdmin);

const sendSchema = z.object({
  subject: z.string().trim().max(200).optional(),
  body: z.string().trim().optional(),
  subjectFr: z.string().trim().max(200).optional(),
  bodyFr: z.string().trim().optional(),
  subjectEn: z.string().trim().max(200).optional(),
  bodyEn: z.string().trim().optional(),
}).superRefine((data, ctx) => {
  const hasLegacy = Boolean(data.subject?.trim() && data.body?.trim());
  const hasFrench = Boolean(data.subjectFr?.trim() && data.bodyFr?.trim());
  const hasEnglish = Boolean(data.subjectEn?.trim() && data.bodyEn?.trim());

  if (!hasLegacy && (!hasFrench || !hasEnglish)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Versions française et anglaise requises',
      path: ['subjectFr'],
    });
  }
});

function contentForLanguage(payload, lang) {
  const en = isEnglish(lang);
  const legacySubject = payload.subject?.trim();
  const legacyBody = payload.body?.trim();
  const subjectFr = payload.subjectFr?.trim() || legacySubject;
  const bodyFr = payload.bodyFr?.trim() || legacyBody;
  const subjectEn = payload.subjectEn?.trim() || legacySubject || subjectFr;
  const bodyEn = payload.bodyEn?.trim() || legacyBody || bodyFr;

  return {
    subject: en ? subjectEn : subjectFr,
    body: en ? bodyEn : bodyFr,
  };
}

router.get('/subscribers', async (req, res, next) => {
  try {
    const count = await prisma.customer.count({ where: { newsletterConsent: true, isActive: true } });
    res.json({ success: true, data: { count } });
  } catch (err) {
    next(err);
  }
});

router.post('/send', validate(sendSchema), async (req, res, next) => {
  try {
    const subscribers = await prisma.customer.findMany({
      where: { newsletterConsent: true, isActive: true },
      select: { email: true, name: true, preferredLanguage: true },
    });

    if (subscribers.length === 0) {
      return res.json({ success: true, data: { sent: 0 } });
    }

    let sent = 0;
    for (const sub of subscribers) {
      try {
        const lang = languageOf(sub);
        const en = isEnglish(lang);
        const { subject, body } = contentForLanguage(req.body, lang);
        const greeting = en ? `Hello ${sub.name},` : `Bonjour ${sub.name},`;
        const htmlBody = emailTextBlock(body);

        await sendEmail({
          to: sub.email,
          profile: 'business',
          lang,
          subject,
          text: `${greeting}\n\n${body}`,
          html: emailHtml({
            lang,
            title: subject,
            recipientEmail: sub.email,
            content: `<p style="margin:0 0 16px;">${en ? 'Hello' : 'Bonjour'} <strong>${emailEscape(sub.name)}</strong>,</p>${htmlBody}`,
          }),
        });
        sent++;
      } catch {
        // continue on individual failure
      }
    }

    res.json({ success: true, data: { sent, total: subscribers.length } });
  } catch (err) {
    next(err);
  }
});

export default router;

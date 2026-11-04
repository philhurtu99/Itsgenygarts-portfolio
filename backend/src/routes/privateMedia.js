import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  privateMediaFilePath,
  verifyPrivateMediaToken,
} from '../utils/privateMedia.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.join(__dirname, '..', '..', 'uploads');
const router = Router();

router.get('/:area/:filename', (req, res) => {
  const area = String(req.params.area || '');
  const filename = String(req.params.filename || '');
  const filePath = privateMediaFilePath(uploadsRoot, area, filename);
  if (!filePath) {
    return res.status(404).json({ success: false, message: 'Image introuvable' });
  }

  try {
    verifyPrivateMediaToken(req.query.token, { area, filename });
  } catch {
    return res.status(403).json({ success: false, message: 'Lien image invalide ou expiré' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'Image introuvable' });
  }

  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.sendFile(filePath);
});

export default router;

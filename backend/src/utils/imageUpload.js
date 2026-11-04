import multer from 'multer';
import sharp from 'sharp';
import { convertHeicImage } from './heicImage.js';

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

function detectImageMime(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
    && buffer[4] === 0x0d
    && buffer[5] === 0x0a
    && buffer[6] === 0x1a
    && buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  const gifHeader = buffer.subarray(0, 6).toString('ascii');
  if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') {
    return 'image/gif';
  }
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp'
    && ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(buffer.subarray(8, 12).toString('ascii'))) {
    return 'image/heic';
  }
  return null;
}

export function validateUploadedImage(file) {
  const detectedMime = detectImageMime(file?.buffer);
  if (!detectedMime) {
    throw Object.assign(new Error('Image invalide. Choisis une photo JPG, PNG, WEBP, GIF ou HEIC.'), { statusCode: 400 });
  }
  return detectedMime;
}

export async function normalizeUploadedImage(file, { allowPhonePhotos = false } = {}) {
  const mimetype = validateUploadedImage(file);
  if (mimetype === 'image/heic') {
    if (!allowPhonePhotos) throw Object.assign(new Error('Type de fichier invalide. Images JPG, PNG, WEBP ou GIF seulement.'), { statusCode: 400 });
    return { buffer: await convertHeicImage(file.buffer), mimetype: 'image/jpeg' };
  }
  try {
    const transformer = sharp(file.buffer, {
      animated: mimetype === 'image/gif', failOn: 'warning', limitInputPixels: 50_000_000,
    }).rotate();
    const normalized = {
      'image/jpeg': () => transformer.jpeg({ quality: 90, mozjpeg: true }),
      'image/png': () => transformer.png({ compressionLevel: 9 }),
      'image/webp': () => transformer.webp({ quality: 90 }),
      'image/gif': () => transformer.gif(),
    }[mimetype];
    return { buffer: await normalized().toBuffer(), mimetype };
  } catch {
    throw Object.assign(new Error('Cette image est illisible ou trop grande. Essaie une autre photo.'), { statusCode: 400 });
  }
}

export function imageUpload(options = {}) {
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: options.fileSize || 5 * 1024 * 1024,
      files: options.files || 5,
    },
    fileFilter: (req, file, cb) => {
      const phoneType = options.allowPhonePhotos && (['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence', 'image/jpg', 'image/pjpeg', 'application/octet-stream', 'binary/octet-stream', ''].includes(file.mimetype));
      if (!ALLOWED_IMAGE_TYPES.has(file.mimetype) && !phoneType) {
        cb(Object.assign(new Error(options.allowPhonePhotos ? 'Type de fichier invalide. Choisis une photo JPG, PNG, WEBP, GIF ou HEIC.' : 'Type de fichier invalide. Images JPG, PNG, WEBP ou GIF seulement.'), { statusCode: 400 }));
        return;
      }
      cb(null, true);
    },
  });
}

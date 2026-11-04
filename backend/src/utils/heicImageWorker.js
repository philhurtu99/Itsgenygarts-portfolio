import { parentPort, workerData } from 'node:worker_threads';
import decode from 'heic-decode';
import sharp from 'sharp';

let images;
try {
  images = await decode.all({ buffer: Buffer.from(workerData) });
  const first = images[0];
  if (!first || first.width * first.height > 50_000_000) throw new Error('image dimensions');
  const { width, height, data } = await first.decode();
  const buffer = await sharp(Buffer.from(data.buffer, data.byteOffset, data.byteLength), {
    raw: { width, height, channels: 4 },
  }).resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
  parentPort.postMessage({ buffer });
} catch {
  parentPort.postMessage({ error: 'Cette photo HEIC est illisible ou trop grande. Essaie de l’exporter en JPG.' });
} finally {
  images?.dispose();
}

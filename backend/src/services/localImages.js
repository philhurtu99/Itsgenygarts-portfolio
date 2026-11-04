import { randomUUID } from 'node:crypto';
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

export const localImagesDirectory = fileURLToPath(new URL('../../.local/images/', import.meta.url));
const localIdPattern = /^local-dev\/([a-f0-9-]{36}\.(?:jpeg|png|webp|gif))$/;

export function localImageStorageEnabled() {
  return process.env.NODE_ENV === 'development' && process.env.IMAGE_STORAGE === 'local';
}

function imageResource(filename) {
  return {
    public_id: `local-dev/${filename}`,
    secure_url: `/api/local-images/${filename}`,
  };
}

export async function uploadLocalImage(buffer) {
  const { format } = await sharp(buffer).metadata();
  if (!['jpeg', 'png', 'webp', 'gif'].includes(format)) throw new Error('Unsupported local image format');
  const filename = `${randomUUID()}.${format}`;
  await mkdir(localImagesDirectory, { recursive: true, mode: 0o700 });
  await writeFile(path.join(localImagesDirectory, filename), buffer, { flag: 'wx', mode: 0o600 });
  return imageResource(filename);
}

export async function deleteLocalImage(publicId) {
  const filename = localIdPattern.exec(publicId)?.[1];
  if (!filename) return { result: 'not found' };
  try {
    await unlink(path.join(localImagesDirectory, filename));
    return { result: 'ok' };
  } catch (error) {
    if (error.code === 'ENOENT') return { result: 'not found' };
    throw error;
  }
}

export async function listLocalImages(maxResults) {
  let filenames;
  try {
    filenames = await readdir(localImagesDirectory);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  return filenames.filter((filename) => localIdPattern.test(`local-dev/${filename}`))
    .sort().slice(0, maxResults).map(imageResource);
}

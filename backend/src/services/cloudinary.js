import { v2 as cloudinary } from 'cloudinary';
import { localImageStorageEnabled, uploadLocalImage, deleteLocalImage, listLocalImages } from './localImages.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadImage(buffer, folder = 'crochet') {
  if (localImageStorageEnabled()) return uploadLocalImage(buffer);
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

export async function deleteImage(publicId) {
  if (!publicId) return null;
  // Never remove production assets while testing against a copied database.
  if (localImageStorageEnabled()) return deleteLocalImage(publicId);
  if (publicId.startsWith('local-dev/')) return null;
  return cloudinary.uploader.destroy(publicId);
}

export async function listAllImages(maxResults = 500) {
  if (localImageStorageEnabled()) return listLocalImages(maxResults);
  const all = [];
  let nextCursor = undefined;
  do {
    const result = await cloudinary.api.resources({
      type: 'upload',
      resource_type: 'image',
      max_results: Math.min(maxResults - all.length, 500),
      next_cursor: nextCursor,
    });
    all.push(...(result.resources || []));
    nextCursor = result.next_cursor;
  } while (nextCursor && all.length < maxResults);
  return all;
}

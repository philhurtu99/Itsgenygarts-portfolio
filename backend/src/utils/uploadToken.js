import jwt from 'jsonwebtoken';

function secret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required for upload tokens');
  }
  return process.env.JWT_SECRET;
}

export function createUploadToken({ type, id, email }) {
  return jwt.sign({
    purpose: 'submission-upload',
    type,
    id: Number(id),
    email: String(email || '').trim().toLowerCase(),
  }, secret(), { expiresIn: '2h' });
}

export function verifyUploadToken(token, { type, id }) {
  const decoded = jwt.verify(String(token || ''), secret());
  if (
    decoded?.purpose !== 'submission-upload'
    || decoded?.type !== type
    || Number(decoded?.id) !== Number(id)
  ) {
    throw new Error('Invalid upload token');
  }
  return decoded;
}

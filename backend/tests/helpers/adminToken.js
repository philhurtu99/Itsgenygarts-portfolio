import jwt from 'jsonwebtoken';

export function makeAdminToken(payload = { type: 'admin', id: 1, role: 'ADMIN' }) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
}

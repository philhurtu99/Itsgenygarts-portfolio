import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { readAuthCookie } from '../utils/authCookie.js';

const prisma = new PrismaClient();

function isAdminRole(role) {
  return String(role || '').toUpperCase() === 'ADMIN';
}

export async function requireAdmin(req, res, next) {
  const cookieToken = readAuthCookie(req, 'admin');
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = cookieToken || bearerToken;

  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded?.type !== 'admin') {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    const userId = Number(decoded.id);
    if (!Number.isInteger(userId)) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, username: true, role: true, isActive: true },
    });
    if (!user || !user.isActive || !isAdminRole(user.role)) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

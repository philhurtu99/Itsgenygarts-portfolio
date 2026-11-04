import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { setAuthCookie, clearAuthCookie } from '../../utils/authCookie.js';
import { requireAdmin } from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/rateLimit.js';

const router = Router();
const prisma = new PrismaClient();

function signAdminToken(user) {
  return jwt.sign(
    { type: 'admin', id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

router.get('/me', requireAdmin, async (req, res, next) => {
  try {
    res.json({ success: true, data: req.user });
  } catch (err) {
    next(err);
  }
});

router.post('/session-token', requireAdmin, async (req, res, next) => {
  try {
    const token = signAdminToken(req.user);
    setAuthCookie(res, 'admin', token, { maxAgeMs: 7 * 24 * 60 * 60 * 1000 });
    res.json({ success: true, data: { token } });
  } catch (err) {
    next(err);
  }
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, username, password } = req.body;

    if ((!email && !username) || !password) {
      return res.status(400).json({ success: false, message: 'Email/username and password are required' });
    }

    const user = email
      ? await prisma.user.findUnique({ where: { email } })
      : await prisma.user.findUnique({ where: { username } });
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = signAdminToken(user);
    setAuthCookie(res, 'admin', token, { maxAgeMs: 7 * 24 * 60 * 60 * 1000 });

    res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, email: user.email, username: user.username, role: user.role },
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res, 'admin');
  res.json({ success: true });
});

router.post('/register', requireAdmin, async (req, res, next) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'Username, email and password are required' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, email, passwordHash, role: role || 'User' },
      select: { id: true, username: true, email: true, role: true, createdAt: true },
    });

    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

export default router;

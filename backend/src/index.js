import 'dotenv/config';
import './sentry.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import * as Sentry from '@sentry/node';
import routes from './routes/index.js';
import errorHandler from './middleware/errorHandler.js';
import localizeResponses from './middleware/localizeResponses.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { localImageStorageEnabled, localImagesDirectory } from './services/localImages.js';
import { expireStalePendingOrders } from './services/pendingOrders.js';
import { deleteExpiredUnverifiedCustomers } from './services/unverifiedCustomers.js';
import {
  currencyRateAutoUpdateEnabled,
  currencyRateUpdateIntervalMs,
  updateCurrencyRates,
} from './services/currencyRates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;
const backgroundJobsEnabled = process.env.BACKGROUND_JOBS_ENABLED !== 'false';

// Production traffic crosses Cloudflare Tunnel and Nginx before Express.
// Keeping this configurable prevents every visitor from sharing the proxy's rate-limit bucket.
const configuredProxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS || '1', 10);
const trustProxyHops = Number.isInteger(configuredProxyHops) && configuredProxyHops >= 1 && configuredProxyHops <= 5
  ? configuredProxyHops
  : 1;
app.set('trust proxy', trustProxyHops);

// Security headers. crossOriginResourcePolicy relaxed so Cloudinary/static assets still load cross-origin.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

const allowedOrigins = (process.env.CORS_ORIGIN || '*').split(',').map((o) => o.trim());
const corsAllowAll = allowedOrigins.includes('*');
if (corsAllowAll && process.env.NODE_ENV === 'production') {
  console.warn('[cors] CORS_ORIGIN="*" is not allowed with cookie auth in production; set explicit origins.');
}
const isDev = process.env.NODE_ENV !== 'production';
const privateNetworkRegex = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) {
      cb(null, true);
    } else if (isDev && (corsAllowAll || privateNetworkRegex.test(origin))) {
      cb(null, true);
    } else {
      const error = new Error('CORS origin not allowed');
      error.status = 403;
      cb(error);
    }
  },
  credentials: true,
}));
// Stripe webhook needs raw body for signature verification — must be before json parser
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(cookieParser());
app.use(localizeResponses);

app.use(['/uploads/custom-orders', '/uploads/quotes'], (req, res) => {
  res.status(404).json({ success: false, message: 'Image introuvable' });
});
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
if (localImageStorageEnabled()) {
  app.use('/api/local-images', express.static(localImagesDirectory, { dotfiles: 'deny', index: false }));
}
app.use('/api', apiLimiter, routes);

Sentry.setupExpressErrorHandler(app);
app.use(errorHandler);

app.listen(PORT, process.env.HOST || '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

async function runPendingOrderCleanup() {
  try {
    const count = await expireStalePendingOrders();
    if (count > 0) {
      console.log(`[orders] Cancelled ${count} stale pending order(s) and released stock`);
    }
  } catch (err) {
    console.error('[orders] Failed to cleanup stale pending orders:', err.message);
  }
}

if (backgroundJobsEnabled) {
  runPendingOrderCleanup();
  setInterval(runPendingOrderCleanup, 60 * 1000);
}

async function runUnverifiedCustomerCleanup() {
  try {
    const count = await deleteExpiredUnverifiedCustomers();
    if (count > 0) {
      console.log(`[customers] Deleted ${count} unverified customer account(s) older than 48h`);
    }
  } catch (err) {
    console.error('[customers] Failed to cleanup unverified customer accounts:', err.message);
  }
}

if (backgroundJobsEnabled) {
  runUnverifiedCustomerCleanup();
  setInterval(runUnverifiedCustomerCleanup, 60 * 60 * 1000);
}

async function runCurrencyRateUpdate() {
  try {
    const result = await updateCurrencyRates();
    const skipped = result.skipped.length ? ` skipped: ${result.skipped.join(', ')}` : '';
    console.log(`[currencies] Updated ${result.updated} rate(s) from ${result.provider}${result.date ? ` (${result.date})` : ''}.${skipped}`);
  } catch (err) {
    console.error('[currencies] Failed to update exchange rates:', err.message);
  }
}

if (backgroundJobsEnabled && currencyRateAutoUpdateEnabled()) {
  runCurrencyRateUpdate();
  setInterval(runCurrencyRateUpdate, currencyRateUpdateIntervalMs());
} else {
  console.log('[currencies] Automatic exchange rate updates disabled');
}

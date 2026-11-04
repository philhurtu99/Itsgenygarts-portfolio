import express from 'express';
import cookieParser from 'cookie-parser';
import errorHandler from '../../src/middleware/errorHandler.js';

export function buildApp(router) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use('/api', router);
  app.use(errorHandler);
  return app;
}

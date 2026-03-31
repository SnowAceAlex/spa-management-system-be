import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { notFound, errorHandler } from './middlewares/error.js';
import { swaggerMiddleware } from '../swagger.js';
import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan('dev'));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  swaggerMiddleware(app);

  app.use('/auth', authRoutes);
  app.use('/users', usersRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

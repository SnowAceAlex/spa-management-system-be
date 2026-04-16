import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { notFound, errorHandler } from './middlewares/error.js';
import { swaggerMiddleware } from '../swagger.js';
import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';
import serviceCategoriesRoutes from './routes/service-categories.routes.js';
import servicesRoutes from './routes/services.routes.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan('dev'));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  swaggerMiddleware(app);

  app.use('/auth', authRoutes);
  app.use('/users', usersRoutes);
  app.use('/service-categories', serviceCategoriesRoutes);
  app.use('/services', servicesRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

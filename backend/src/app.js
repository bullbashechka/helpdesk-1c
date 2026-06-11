import cors from 'cors';
import express from 'express';

import { env } from './config/env.js';
import { healthRouter } from './routes/health.routes.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.frontendOrigin }));
  app.use(express.json());

  app.use('/api/health', healthRouter);

  app.use((req, res) => {
    res.status(404).json({
      error: 'Not found',
      path: req.originalUrl,
    });
  });

  app.use((err, req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }

    console.error(err);
    res.status(500).json({
      error: 'Internal server error',
    });
  });

  return app;
}

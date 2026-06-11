import cors from 'cors';
import express from 'express';

import { env } from './config/env.js';
import { categoriesRouter, statusesRouter } from './routes/dictionaries.routes.js';
import { clientsRouter } from './routes/clients.routes.js';
import { contractsRouter } from './routes/contracts.routes.js';
import { employeesRouter } from './routes/employees.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { ticketsRouter } from './routes/tickets.routes.js';
import { errorHandler } from './middleware/error-handler.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.frontendOrigin }));
  app.use(express.json());

  app.use('/api/health', healthRouter);
  app.use('/api/clients', clientsRouter);
  app.use('/api/contracts', contractsRouter);
  app.use('/api/employees', employeesRouter);
  app.use('/api/statuses', statusesRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/tickets', ticketsRouter);

  app.use((req, res) => {
    res.status(404).json({
      error: 'Not found',
      path: req.originalUrl,
    });
  });

  app.use(errorHandler);

  return app;
}

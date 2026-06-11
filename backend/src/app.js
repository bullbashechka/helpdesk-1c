import cors from 'cors';
import express from 'express';

import { env } from './config/env.js';
import { dashboardRouter } from './routes/dashboard.routes.js';
import { clientsRouter, contractsRouter, employeesRouter } from './routes/directories.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { reportsRouter } from './routes/reports.routes.js';
import { ticketsRouter } from './routes/tickets.routes.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.frontendOrigin }));
  app.use(express.json());

  app.use('/api/health', healthRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/clients', clientsRouter);
  app.use('/api/contracts', contractsRouter);
  app.use('/api/employees', employeesRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/tickets', ticketsRouter);

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

    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({
        message: 'Некорректный JSON в теле запроса.',
      });
      return;
    }

    console.error(err);
    res.status(500).json({
      message: 'Сервер не смог обработать запрос. Попробуйте позже.',
    });
  });

  return app;
}

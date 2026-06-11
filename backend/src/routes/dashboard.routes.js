import { Router } from 'express';

import { getDashboardSummary } from '../services/dashboard.service.js';

export const dashboardRouter = Router();

dashboardRouter.get('/', (req, res) => {
  res.json(getDashboardSummary());
});

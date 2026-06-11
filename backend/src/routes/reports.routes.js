import { Router } from 'express';

import { getEmployeeHoursReport, getTicketsReport } from '../services/reports.service.js';

export const reportsRouter = Router();

reportsRouter.get('/tickets', (req, res) => {
  const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom : '';
  const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo : '';

  res.json(getTicketsReport({ dateFrom, dateTo }));
});

reportsRouter.get('/employee-hours', (req, res) => {
  const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom : '';
  const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo : '';

  res.json(getEmployeeHoursReport({ dateFrom, dateTo }));
});

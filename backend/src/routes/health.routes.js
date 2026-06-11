import { Router } from 'express';

import { getHealth } from '../services/health.service.js';

export const healthRouter = Router();

healthRouter.get('/', (req, res) => {
  res.json(getHealth());
});

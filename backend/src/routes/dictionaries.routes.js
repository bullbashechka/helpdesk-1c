import { Router } from 'express';

import { asyncHandler } from '../middleware/async-handler.js';
import { listCategories, listStatuses } from '../services/dictionaries.service.js';

export const statusesRouter = Router();
export const categoriesRouter = Router();

statusesRouter.get('/', asyncHandler((req, res) => {
  res.json(listStatuses());
}));

categoriesRouter.get('/', asyncHandler((req, res) => {
  res.json(listCategories());
}));

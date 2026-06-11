import { Router } from 'express';

import { asyncHandler } from '../middleware/async-handler.js';
import { sendCreated, sendSuccess } from '../utils/http.js';
import {
  createContract,
  deleteContract,
  getContract,
  listContracts,
  updateContract,
} from '../services/contracts.service.js';

export const contractsRouter = Router();

contractsRouter.get('/', asyncHandler((req, res) => {
  res.json(listContracts());
}));

contractsRouter.post('/', asyncHandler((req, res) => {
  sendCreated(res, createContract(req.body));
}));

contractsRouter.get('/:id', asyncHandler((req, res) => {
  res.json(getContract(req.params.id));
}));

contractsRouter.put('/:id', asyncHandler((req, res) => {
  res.json(updateContract(req.params.id, req.body));
}));

contractsRouter.delete('/:id', asyncHandler((req, res) => {
  deleteContract(req.params.id);
  sendSuccess(res);
}));

import { Router } from 'express';

import { asyncHandler } from '../middleware/async-handler.js';
import { sendCreated, sendSuccess } from '../utils/http.js';
import {
  createClient,
  deleteClient,
  getClient,
  listClients,
  updateClient,
} from '../services/clients.service.js';

export const clientsRouter = Router();

clientsRouter.get('/', asyncHandler((req, res) => {
  res.json(listClients());
}));

clientsRouter.post('/', asyncHandler((req, res) => {
  sendCreated(res, createClient(req.body));
}));

clientsRouter.get('/:id', asyncHandler((req, res) => {
  res.json(getClient(req.params.id));
}));

clientsRouter.put('/:id', asyncHandler((req, res) => {
  res.json(updateClient(req.params.id, req.body));
}));

clientsRouter.delete('/:id', asyncHandler((req, res) => {
  deleteClient(req.params.id);
  sendSuccess(res);
}));

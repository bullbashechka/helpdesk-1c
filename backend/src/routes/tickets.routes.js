import { Router } from 'express';

import { asyncHandler } from '../middleware/async-handler.js';
import { sendCreated, sendSuccess } from '../utils/http.js';
import {
  createTicket,
  deleteTicket,
  getTicket,
  listTickets,
  updateTicket,
} from '../services/tickets.service.js';
import { createTicketWorkLog, listTicketWorkLogs } from '../services/work-logs.service.js';

export const ticketsRouter = Router();

ticketsRouter.get('/', asyncHandler((req, res) => {
  res.json(listTickets(req.query));
}));

ticketsRouter.post('/', asyncHandler((req, res) => {
  sendCreated(res, createTicket(req.body));
}));

ticketsRouter.get('/:id', asyncHandler((req, res) => {
  res.json(getTicket(req.params.id));
}));

ticketsRouter.put('/:id', asyncHandler((req, res) => {
  res.json(updateTicket(req.params.id, req.body));
}));

ticketsRouter.delete('/:id', asyncHandler((req, res) => {
  deleteTicket(req.params.id);
  sendSuccess(res);
}));

ticketsRouter.get('/:id/work-logs', asyncHandler((req, res) => {
  res.json(listTicketWorkLogs(req.params.id));
}));

ticketsRouter.post('/:id/work-logs', asyncHandler((req, res) => {
  sendCreated(res, createTicketWorkLog(req.params.id, req.body));
}));

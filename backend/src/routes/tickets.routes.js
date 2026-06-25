import { Router } from 'express';

import {
  addWorkLog,
  createTicket,
  getTicketById,
  getTicketMeta,
  listTickets,
  updateTicket,
} from '../services/tickets.service.js';

export const ticketsRouter = Router();

ticketsRouter.get('/', (req, res) => {
  const search = typeof req.query.q === 'string' ? req.query.q : '';
  const overdueOnly = req.query.overdue === '1' || req.query.overdue === 'true';

  res.json({ items: listTickets({ overdueOnly, search }) });
});

ticketsRouter.get('/meta', (req, res) => {
  res.json(getTicketMeta());
});

ticketsRouter.post('/', (req, res) => {
  try {
    const ticket = createTicket(req.body || {});
    res.status(201).json(ticket);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

ticketsRouter.put('/:id', (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ message: 'Некорректный идентификатор заявки.' });
    return;
  }

  try {
    const ticket = updateTicket(id, req.body || {});

    if (!ticket) {
      res.status(404).json({ message: 'Заявка не найдена.' });
      return;
    }

    res.json(ticket);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

ticketsRouter.post('/:id/work-logs', (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ message: 'Некорректный идентификатор заявки.' });
    return;
  }

  try {
    const ticket = addWorkLog(id, req.body || {});

    if (!ticket) {
      res.status(404).json({ message: 'Заявка не найдена.' });
      return;
    }

    res.status(201).json(ticket);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

ticketsRouter.get('/:id', (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ message: 'Некорректный идентификатор заявки.' });
    return;
  }

  const ticket = getTicketById(id);

  if (!ticket) {
    res.status(404).json({ message: 'Заявка не найдена.' });
    return;
  }

  res.json(ticket);
});

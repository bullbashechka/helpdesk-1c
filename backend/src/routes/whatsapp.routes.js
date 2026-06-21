import { Router } from 'express';

import { env } from '../config/env.js';
import {
  archiveMessage,
  createTaskFromMessage,
  getAttachmentForDownload,
  getConnectorStatus,
  getMessagesSummary,
  getMessageWithAttachments,
  getTaskById,
  getTasksSummary,
  ingestMessage,
  listMessages,
  listTasks,
  unarchiveMessage,
  updateTask,
  upsertConnectorStatus,
} from '../services/whatsapp.service.js';

export const whatsappRouter = Router();

function requireConnectorToken(req, res, next) {
  const token = req.headers['x-connector-token'];
  if (!token || token !== env.whatsappConnectorToken) {
    res.status(401).json({ message: 'Неверный или отсутствующий токен коннектора.' });
    return;
  }
  next();
}

whatsappRouter.post('/ingest', requireConnectorToken, (req, res) => {
  try {
    const result = ingestMessage(req.body);
    res.status(result.deduplicated ? 200 : 201).json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

whatsappRouter.post('/status', requireConnectorToken, (req, res) => {
  try {
    upsertConnectorStatus(req.body);
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

whatsappRouter.get('/messages/summary', (req, res) => {
  res.json(getMessagesSummary());
});

whatsappRouter.get('/messages', (req, res) => {
  const { status, limit, offset } = req.query;
  const result = listMessages({ status, limit, offset });
  res.json(result);
});

whatsappRouter.get('/attachments/:id', (req, res) => {
  const file = getAttachmentForDownload(req.params.id);
  if (!file) {
    res.status(404).json({ message: 'Вложение не найдено.' });
    return;
  }

  const disposition = req.query.download ? 'attachment' : 'inline';
  res.setHeader('Content-Type', file.mime_type);
  res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(file.original_name)}"`);
  res.sendFile(file.absPath);
});

whatsappRouter.get('/messages/:id', (req, res) => {
  const message = getMessageWithAttachments(req.params.id);
  if (!message) {
    res.status(404).json({ message: 'Сообщение не найдено.' });
    return;
  }

  res.json(message);
});

whatsappRouter.get('/status', (req, res) => {
  const status = getConnectorStatus(req.query.receiver_id ?? 1);
  if (!status) {
    res.json({ state: 'disconnected', last_heartbeat_at: null, qr_data_url: null });
    return;
  }
  res.json(status);
});

// --- Операторские действия над сообщениями ---

function handleMessageActionError(res, err) {
  if (err.notFound) return res.status(404).json({ message: err.message });
  return res.status(400).json({ message: err.message });
}

whatsappRouter.post('/messages/:id/archive', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ message: 'Некорректный идентификатор сообщения.' });
  }
  try {
    archiveMessage(id);
    return res.status(204).end();
  } catch (err) {
    return handleMessageActionError(res, err);
  }
});

whatsappRouter.post('/messages/:id/unarchive', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ message: 'Некорректный идентификатор сообщения.' });
  }
  try {
    unarchiveMessage(id);
    return res.status(204).end();
  } catch (err) {
    return handleMessageActionError(res, err);
  }
});

// --- Задачи WhatsApp ---

whatsappRouter.get('/tasks/summary', (req, res) => {
  res.json(getTasksSummary());
});

whatsappRouter.get('/tasks', (req, res) => {
  const { status, limit, offset } = req.query;
  res.json(listTasks({ status, limit, offset }));
});

whatsappRouter.post('/tasks', (req, res) => {
  try {
    const task = createTaskFromMessage(req.body ?? {});
    return res.status(201).json(task);
  } catch (err) {
    if (err.notFound) return res.status(404).json({ message: err.message });
    if (err.conflict || (err.message ?? '').toLowerCase().includes('unique constraint')) {
      return res.status(409).json({ message: err.message || 'Из этого сообщения уже создана задача.' });
    }
    return res.status(400).json({ message: err.message ?? 'Не удалось создать задачу.' });
  }
});

whatsappRouter.get('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ message: 'Некорректный идентификатор задачи.' });
  }
  const task = getTaskById(id);
  if (!task) return res.status(404).json({ message: 'Задача не найдена.' });
  return res.json(task);
});

whatsappRouter.put('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ message: 'Некорректный идентификатор задачи.' });
  }
  try {
    const task = updateTask(id, req.body ?? {});
    if (!task) return res.status(404).json({ message: 'Задача не найдена.' });
    return res.json(task);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

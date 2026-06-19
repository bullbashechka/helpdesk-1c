import { Router } from 'express';

import { env } from '../config/env.js';
import {
  getAttachmentForDownload,
  getConnectorStatus,
  ingestMessage,
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

whatsappRouter.get('/status', (req, res) => {
  const status = getConnectorStatus(req.query.receiver_id ?? 1);
  if (!status) {
    res.json({ state: 'disconnected', last_heartbeat_at: null, qr_data_url: null });
    return;
  }
  res.json(status);
});

import { apiClient } from './apiClient.js';

export function fetchWaMessages({ status, limit, offset } = {}) {
  const query = {};
  if (status) query.status = status;
  if (limit != null) query.limit = limit;
  if (offset != null) query.offset = offset;
  return apiClient.get('/whatsapp/messages', { query });
}

export function fetchWaSummary() {
  return apiClient.get('/whatsapp/messages/summary');
}

export function fetchConnectorStatus() {
  return apiClient.get('/whatsapp/status');
}

export function fetchWaMessage(id) {
  return apiClient.get(`/whatsapp/messages/${id}`);
}

export function attachmentUrl(id, { download = false } = {}) {
  const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
  return `${base}/whatsapp/attachments/${id}${download ? '?download=1' : ''}`;
}

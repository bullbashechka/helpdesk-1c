import { apiClient } from './apiClient.js';

export function fetchWaMessage(id) {
  return apiClient.get(`/whatsapp/messages/${id}`);
}

export function attachmentUrl(id, { download = false } = {}) {
  const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
  return `${base}/whatsapp/attachments/${id}${download ? '?download=1' : ''}`;
}

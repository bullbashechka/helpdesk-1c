import { apiClient } from './apiClient.js';

export async function fetchTickets(params = {}) {
  return apiClient.get('/tickets', { query: params });
}

export async function fetchTicket(ticketId) {
  return apiClient.get(`/tickets/${ticketId}`);
}

export async function fetchTicketMeta() {
  return apiClient.get('/tickets/meta');
}

export async function createTicket(values) {
  return apiClient.post('/tickets', values);
}

export async function updateTicket(ticketId, values) {
  return apiClient.put(`/tickets/${ticketId}`, values);
}

export async function addTicketWorkLog(ticketId, values) {
  return apiClient.post(`/tickets/${ticketId}/work-logs`, values);
}

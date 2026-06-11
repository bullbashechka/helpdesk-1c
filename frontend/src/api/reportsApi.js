import { apiClient } from './apiClient.js';

export async function fetchTicketsReport(params = {}) {
  return apiClient.get('/reports/tickets', { query: params });
}

export async function fetchEmployeeHoursReport(params = {}) {
  return apiClient.get('/reports/employee-hours', { query: params });
}

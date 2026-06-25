import { apiClient } from './apiClient.js';

export async function fetchDashboardSummary() {
  return apiClient.get('/dashboard');
}

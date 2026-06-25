import { apiClient } from './apiClient.js';

export async function fetchHealth() {
  return apiClient.get('/health');
}

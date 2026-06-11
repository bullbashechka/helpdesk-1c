import { badRequest } from '../errors/api-error.js';

export function parsePositiveId(value, message) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw badRequest(message);
  }

  return id;
}

export function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function nullableString(value) {
  const trimmed = trimString(value);
  return trimmed || null;
}

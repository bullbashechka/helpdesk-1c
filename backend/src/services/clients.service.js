import { getDatabase } from '../db/connection.js';
import { badRequest, notFound } from '../errors/api-error.js';

export function listClients() {
  return getDatabase().prepare(`
    SELECT id, name, tax_id, contact_person, phone, email, address, created_at, updated_at
    FROM clients
    ORDER BY name
  `).all().map(mapClient);
}

export function getClient(id) {
  const client = getDatabase().prepare(`
    SELECT id, name, tax_id, contact_person, phone, email, address, created_at, updated_at
    FROM clients
    WHERE id = ?
  `).get(id);

  if (!client) {
    throw notFound('Клиент не найден.');
  }

  return mapClient(client);
}

export function createClient(payload) {
  const data = normalizeClientPayload(payload);
  const result = getDatabase().prepare(`
    INSERT INTO clients (name, tax_id, contact_person, phone, email, address)
    VALUES (@name, @taxId, @contactPerson, @phone, @email, @address)
  `).run(data);

  return getClient(result.lastInsertRowid);
}

export function updateClient(id, payload) {
  getClient(id);
  const data = normalizeClientPayload(payload);

  getDatabase().prepare(`
    UPDATE clients
    SET
      name = @name,
      tax_id = @taxId,
      contact_person = @contactPerson,
      phone = @phone,
      email = @email,
      address = @address,
      updated_at = datetime('now')
    WHERE id = @id
  `).run({ ...data, id });

  return getClient(id);
}

export function deleteClient(id) {
  getClient(id);
  getDatabase().prepare('DELETE FROM clients WHERE id = ?').run(id);
}

function normalizeClientPayload(payload = {}) {
  const name = trimString(payload.name);

  if (!name) {
    throw badRequest('Укажите наименование клиента.');
  }

  return {
    name,
    taxId: nullableString(payload.taxId),
    contactPerson: nullableString(payload.contactPerson),
    phone: nullableString(payload.phone),
    email: nullableString(payload.email),
    address: nullableString(payload.address),
  };
}

function mapClient(row) {
  return {
    id: row.id,
    name: row.name,
    taxId: row.tax_id,
    contactPerson: row.contact_person,
    phone: row.phone,
    email: row.email,
    address: row.address,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function nullableString(value) {
  const trimmed = trimString(value);
  return trimmed || null;
}

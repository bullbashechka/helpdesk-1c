import { getDatabase } from '../db/connection.js';
import { badRequest, notFound } from '../errors/api-error.js';

export function listContracts() {
  return getDatabase().prepare(`
    SELECT
      c.id,
      c.client_id,
      c.number,
      c.start_date,
      c.end_date,
      c.support_type,
      c.tariff,
      c.created_at,
      c.updated_at,
      cl.name AS client_name
    FROM contracts c
    JOIN clients cl ON cl.id = c.client_id
    ORDER BY c.number
  `).all().map(mapContract);
}

export function getContract(id) {
  const contract = getDatabase().prepare(`
    SELECT
      c.id,
      c.client_id,
      c.number,
      c.start_date,
      c.end_date,
      c.support_type,
      c.tariff,
      c.created_at,
      c.updated_at,
      cl.name AS client_name
    FROM contracts c
    JOIN clients cl ON cl.id = c.client_id
    WHERE c.id = ?
  `).get(id);

  if (!contract) {
    throw notFound('Договор не найден.');
  }

  return mapContract(contract);
}

export function createContract(payload) {
  const data = normalizeContractPayload(payload);
  const result = getDatabase().prepare(`
    INSERT INTO contracts (client_id, number, start_date, end_date, support_type, tariff)
    VALUES (@clientId, @number, @startDate, @endDate, @supportType, @tariff)
  `).run(data);

  return getContract(result.lastInsertRowid);
}

export function updateContract(id, payload) {
  getContract(id);
  const data = normalizeContractPayload(payload);

  getDatabase().prepare(`
    UPDATE contracts
    SET
      client_id = @clientId,
      number = @number,
      start_date = @startDate,
      end_date = @endDate,
      support_type = @supportType,
      tariff = @tariff,
      updated_at = datetime('now')
    WHERE id = @id
  `).run({ ...data, id });

  return getContract(id);
}

export function deleteContract(id) {
  getContract(id);
  getDatabase().prepare('DELETE FROM contracts WHERE id = ?').run(id);
}

function normalizeContractPayload(payload = {}) {
  const clientId = Number(payload.clientId);
  const number = trimString(payload.number);

  if (!Number.isInteger(clientId) || clientId <= 0) {
    throw badRequest('Выберите клиента для договора.');
  }

  if (!number) {
    throw badRequest('Укажите номер договора.');
  }

  return {
    clientId,
    number,
    startDate: nullableString(payload.startDate),
    endDate: nullableString(payload.endDate),
    supportType: nullableString(payload.supportType),
    tariff: nullableString(payload.tariff),
  };
}

function mapContract(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    number: row.number,
    startDate: row.start_date,
    endDate: row.end_date,
    supportType: row.support_type,
    tariff: row.tariff,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    client: {
      id: row.client_id,
      name: row.client_name,
    },
  };
}

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function nullableString(value) {
  const trimmed = trimString(value);
  return trimmed || null;
}

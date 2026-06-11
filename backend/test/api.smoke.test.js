import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';

const testDataDir = mkdtempSync(join(tmpdir(), 'helpdesk-1c-'));
process.env.SQLITE_DB_PATH = join(testDataDir, 'helpdesk.sqlite');
process.env.FRONTEND_ORIGIN = 'http://localhost:5173';

const { createApp } = await import('../src/app.js');
const { closeDatabase } = await import('../src/db/database.js');

let baseUrl;
let server;

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  return { payload, response };
}

describe('API smoke', () => {
  before(async () => {
    const app = createApp();

    server = await new Promise((resolve) => {
      const listener = app.listen(0, () => resolve(listener));
    });

    baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });

    closeDatabase();
    rmSync(testDataDir, { force: true, recursive: true });
  });

  test('starts with demo data and exposes core screens data', async () => {
    const endpoints = [
      '/health',
      '/dashboard',
      '/tickets',
      '/tickets/meta',
      '/clients',
      '/contracts',
      '/employees',
      '/reports/tickets',
      '/reports/employee-hours',
    ];

    for (const endpoint of endpoints) {
      const { response } = await request(endpoint);
      assert.equal(response.status, 200, endpoint);
    }

    const { payload: clients } = await request('/clients');
    const { payload: contracts } = await request('/contracts');
    const { payload: employees } = await request('/employees');
    const { payload: tickets } = await request('/tickets');
    const { payload: ticketReport } = await request('/reports/tickets');
    const { payload: hoursReport } = await request('/reports/employee-hours');

    assert.ok(clients.items.length >= 3);
    assert.ok(contracts.items.length >= 3);
    assert.ok(employees.items.length >= 3);
    assert.ok(tickets.items.length >= 4);
    assert.ok(ticketReport.items.length >= 4);
    assert.ok(hoursReport.items.length >= 3);
  });

  test('keeps overdue calculation consistent between dashboard and list', async () => {
    const { payload: dashboard } = await request('/dashboard');
    const { payload: overdueTickets } = await request('/tickets?overdue=1');

    assert.equal(dashboard.totals.overdueTickets, overdueTickets.items.length);
    assert.ok(overdueTickets.items.every((ticket) => ticket.isOverdue));
  });

  test('validates required ticket fields without leaking internals', async () => {
    const { payload, response } = await request('/tickets', {
      body: JSON.stringify({}),
      method: 'POST',
    });

    assert.equal(response.status, 400);
    assert.equal(typeof payload.message, 'string');
    assert.ok(payload.message.length > 0);
    assert.equal(payload.stack, undefined);
  });

  test('creates and updates a ticket, then adds a work log', async () => {
    const { payload: meta } = await request('/tickets/meta');
    const status = meta.statuses.find((item) => item.code === 'new') ?? meta.statuses[0];
    const category = meta.categories[0];
    const contract = meta.contracts[0];
    const employee = meta.employees[0];

    const createPayload = {
      categoryId: category.id,
      contractId: contract.id,
      deadlineAt: '',
      description: 'Smoke create check',
      priority: 'normal',
      responsibleEmployeeId: employee.id,
      statusId: status.id,
      subject: 'Smoke test ticket',
    };

    const { payload: createdTicket, response: createResponse } = await request('/tickets', {
      body: JSON.stringify(createPayload),
      method: 'POST',
    });

    assert.equal(createResponse.status, 201);
    assert.equal(createdTicket.subject, createPayload.subject);

    const { payload: updatedTicket, response: updateResponse } = await request(`/tickets/${createdTicket.id}`, {
      body: JSON.stringify({ ...createPayload, priority: 'high', subject: 'Smoke test ticket updated' }),
      method: 'PUT',
    });

    assert.equal(updateResponse.status, 200);
    assert.equal(updatedTicket.priority, 'high');

    const { payload: ticketWithWorkLog, response: workLogResponse } = await request(
      `/tickets/${createdTicket.id}/work-logs`,
      {
        body: JSON.stringify({
          description: 'Smoke work log',
          employeeId: employee.id,
          hours: 1,
          workDate: new Date().toISOString().slice(0, 10),
        }),
        method: 'POST',
      },
    );

    assert.equal(workLogResponse.status, 201);
    assert.ok(ticketWithWorkLog.workLogs.some((workLog) => workLog.description === 'Smoke work log'));
  });

  test('returns a clear conflict when deleting linked records', async () => {
    const { payload, response } = await request('/clients/1', { method: 'DELETE' });

    assert.equal(response.status, 409);
    assert.equal(typeof payload.message, 'string');
    assert.ok(payload.message.length > 0);
    assert.equal(payload.stack, undefined);
  });
});

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';

const { createQueue } = await import('../src/queue.js');

let queueDir;
let queue;

describe('queue', () => {
  before(() => {
    queueDir = mkdtempSync(join(tmpdir(), 'helpdesk-queue-'));
    queue = createQueue(queueDir);
  });

  after(() => {
    rmSync(queueDir, { force: true, recursive: true });
  });

  test('enqueue adds item, list returns it', () => {
    queue.enqueue({ wa_message_id: 'msg_1', body: 'hello' });
    const items = queue.list();
    assert.equal(items.length, 1);
    assert.equal(items[0].wa_message_id, 'msg_1');
  });

  test('remove deletes item from queue', () => {
    queue.remove('msg_1');
    assert.equal(queue.list().length, 0);
  });

  test('enqueue multiple, remove one, rest intact', () => {
    queue.enqueue({ wa_message_id: 'msg_A', body: 'a' });
    queue.enqueue({ wa_message_id: 'msg_B', body: 'b' });
    queue.remove('msg_A');
    const items = queue.list();
    assert.equal(items.length, 1);
    assert.equal(items[0].wa_message_id, 'msg_B');
    queue.remove('msg_B');
  });

  test('persists between createQueue instances (same dir)', () => {
    queue.enqueue({ wa_message_id: 'persist_1', body: 'x' });
    const queue2 = createQueue(queueDir);
    const items = queue2.list();
    assert.equal(items.some((i) => i.wa_message_id === 'persist_1'), true);
    queue2.remove('persist_1');
  });

  test('remove non-existent id is a no-op', () => {
    assert.doesNotThrow(() => queue.remove('does_not_exist'));
  });

  test('wa_message_id with special chars produces valid filename', () => {
    const id = 'false_AA11@c.us_99:BB';
    queue.enqueue({ wa_message_id: id, body: 'special' });
    const items = queue.list();
    assert.ok(items.some((i) => i.wa_message_id === id));
    queue.remove(id);
  });
});

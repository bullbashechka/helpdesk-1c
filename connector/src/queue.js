import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function createQueue(queueDir) {
  mkdirSync(queueDir, { recursive: true });

  function safeName(waMessageId) {
    // Filesystem-safe filename from wa_message_id.
    return waMessageId.replace(/[^a-zA-Z0-9_\-]/g, '_') + '.json';
  }

  function enqueue(payload) {
    const file = join(queueDir, safeName(payload.wa_message_id));
    writeFileSync(file, JSON.stringify(payload), 'utf8');
  }

  function list() {
    try {
      return readdirSync(queueDir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => {
          try {
            return JSON.parse(readFileSync(join(queueDir, f), 'utf8'));
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  function remove(waMessageId) {
    try {
      rmSync(join(queueDir, safeName(waMessageId)), { force: true });
    } catch {
      // ignore
    }
  }

  return { enqueue, list, remove };
}

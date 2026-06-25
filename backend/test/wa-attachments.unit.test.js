import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { extFromMime, resolveSafePath, storedName } from '../src/services/wa-attachments.service.js';

describe('wa-attachments helpers', () => {
  test('extFromMime по mime', () => {
    assert.equal(extFromMime('image/png', null), 'png');
    assert.equal(extFromMime('image/jpeg', null), 'jpg');
    assert.equal(extFromMime('application/pdf', 'отчёт.pdf'), 'pdf');
  });

  test('extFromMime дефолт bin', () => {
    assert.equal(extFromMime(null, null), 'bin');
    assert.equal(extFromMime('weird/type', 'file.exe!!'), 'exe');
  });

  test('storedName генерится из id/index/ext', () => {
    assert.equal(storedName(42, 0, 'png'), '42-0.png');
  });

  test('resolveSafePath отбивает traversal', () => {
    assert.equal(resolveSafePath('../../etc/passwd'), null);
    assert.ok(resolveSafePath('42-0.png'));
  });
});

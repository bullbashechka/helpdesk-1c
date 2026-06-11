import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { buildCsv } from './csv.js';

describe('buildCsv', () => {
  test('exports report rows with escaped cells', () => {
    const csv = buildCsv(
      [
        { key: 'number', label: 'Number' },
        { key: 'subject', label: 'Subject' },
        { key: 'hours', label: 'Hours', getValue: (row) => row.hours.toFixed(1) },
      ],
      [
        { hours: 1.5, number: '#1', subject: 'Plain subject' },
        { hours: 2, number: '#2', subject: 'Contains, comma and "quote"' },
      ],
    );

    assert.equal(
      csv,
      'Number,Subject,Hours\r\n#1,Plain subject,1.5\r\n#2,"Contains, comma and ""quote""",2.0',
    );
  });
});

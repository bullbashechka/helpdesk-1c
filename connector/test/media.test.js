import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { availabilityForSize, base64Bytes, classifyMedia, MAX_ATTACHMENT_BYTES } from '../src/media.js';

const m = (over) => ({ type: 'chat', _data: {}, ...over });

describe('classifyMedia', () => {
  test('image → photo', () => assert.deepEqual(classifyMedia(m({ type: 'image' })), { kind: 'photo', skip: false }));
  test('video → video', () => assert.deepEqual(classifyMedia(m({ type: 'video' })), { kind: 'video', skip: false }));
  test('gif (video+isGif) → skip', () => assert.equal(classifyMedia(m({ type: 'video', _data: { isGif: true } })).skip, true));
  test('document → document', () => assert.deepEqual(classifyMedia(m({ type: 'document' })), { kind: 'document', skip: false }));
  test('ptt → voice', () => assert.deepEqual(classifyMedia(m({ type: 'ptt' })), { kind: 'voice', skip: false }));
  test('audio → skip', () => assert.equal(classifyMedia(m({ type: 'audio' })).skip, true));
  test('sticker → skip', () => assert.equal(classifyMedia(m({ type: 'sticker' })).skip, true));
  test('chat → skip (не медиа)', () => assert.equal(classifyMedia(m({ type: 'chat' })).skip, true));
});

describe('size', () => {
  test('малый → stored', () => assert.equal(availabilityForSize(1000), 'stored'));
  test('больше лимита → too_large', () => assert.equal(availabilityForSize(MAX_ATTACHMENT_BYTES + 1), 'too_large'));
  test('base64Bytes считает размер', () => assert.equal(base64Bytes(Buffer.from('hello').toString('base64')), 5));
});

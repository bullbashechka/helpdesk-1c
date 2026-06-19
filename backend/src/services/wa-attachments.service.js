import { mkdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve, sep } from 'node:path';

import { env } from '../config/env.js';

const MIME_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/3gpp': '3gp',
  'video/quicktime': 'mov',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
};

function sanitizeExt(raw) {
  const cleaned = String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return cleaned || 'bin';
}

export function extFromMime(mime, originalName) {
  if (mime && MIME_EXT[mime]) return MIME_EXT[mime];
  if (originalName && originalName.includes('.')) return sanitizeExt(originalName.split('.').pop());
  if (mime && mime.includes('/')) return sanitizeExt(mime.split('/')[1]);
  return 'bin';
}

export function storedName(messageId, index, ext) {
  return `${messageId}-${index}.${sanitizeExt(ext)}`;
}

export function attachmentsDir() {
  const dir = resolve(env.waAttachmentsDir);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function resolveSafePath(relativeName) {
  if (!relativeName || isAbsolute(relativeName)) return null;
  const dir = attachmentsDir();
  const abs = resolve(join(dir, relativeName));
  return abs === dir || abs.startsWith(`${dir}${sep}`) ? abs : null;
}

export function writeAttachmentFile(relativeName, base64) {
  const abs = resolveSafePath(relativeName);
  if (!abs) throw new Error('Небезопасное имя файла вложения.');
  writeFileSync(abs, Buffer.from(base64, 'base64'));
}

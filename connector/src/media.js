export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export function classifyMedia(msg) {
  const type = msg?.type;

  if (type === 'image') return { kind: 'photo', skip: false };
  if (type === 'video') return msg._data?.isGif ? { skip: true } : { kind: 'video', skip: false };
  if (type === 'document') return { kind: 'document', skip: false };
  if (type === 'ptt') return { kind: 'voice', skip: false };

  return { skip: true };
}

export function base64Bytes(data) {
  if (!data) return 0;
  return Buffer.from(data, 'base64').length;
}

export function availabilityForSize(bytes) {
  return bytes > MAX_ATTACHMENT_BYTES ? 'too_large' : 'stored';
}

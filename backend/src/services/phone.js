// Strips all non-digit chars; for WhatsApp JIDs like "77071234567@c.us" extracts digits before "@".
export function normalizePhone(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const withoutDomain = raw.includes('@') ? raw.split('@')[0] : raw;
  return withoutDomain.replace(/\D/g, '');
}

// Loose match: compares last N digits to handle 8/+7 prefix divergence.
const TAIL_LENGTH = 10;

export function phonesMatch(a, b) {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (!na || !nb) return false;
  return na.slice(-TAIL_LENGTH) === nb.slice(-TAIL_LENGTH);
}

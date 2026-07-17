const E164_RE = /^\+[1-9]\d{1,14}$/;

function isE164(value) {
  return typeof value === 'string' && E164_RE.test(value);
}

/**
 * Normalizes US-style input to E.164. Twilio always sends To/From already in
 * E.164, so this only matters for numbers typed into the admin form.
 */
function normalizeToE164(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (isE164(trimmed)) return trimmed;

  const digits = trimmed.replace(/[^\d]/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

module.exports = { isE164, normalizeToE164 };

/**
 * Utility to guarantee safe String conversion for any value rendered in JSX,
 * strictly preventing 'Minified React error #31' (Objects are not valid as a React child).
 */
export function safeString(val: unknown, fallback = ''): string {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (typeof val === 'object') {
    const obj = val as Record<string, any>;
    if (typeof obj.message === 'string' && obj.message.trim()) return obj.message.trim();
    if (typeof obj.error === 'string' && obj.error.trim()) return obj.error.trim();
    if (typeof obj.details === 'string' && obj.details.trim()) return obj.details.trim();
    if (obj.message && typeof obj.message === 'object') return safeString(obj.message, fallback);
    if (obj.error && typeof obj.error === 'object') return safeString(obj.error, fallback);
    try {
      const serialized = JSON.stringify(val);
      return serialized !== '{}' ? serialized : fallback;
    } catch {
      return fallback;
    }
  }
  return String(val);
}

export function extractErrorMessage(err: unknown, fallback = 'Ha ocurrido un error inesperado al procesar la solicitud.'): string {
  if (!err) return fallback;
  const str = safeString(err, fallback);
  return str && str !== '{}' ? str : fallback;
}

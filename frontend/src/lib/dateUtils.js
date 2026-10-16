/**
 * dateUtils.js — UTC-safe date helpers
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * MongoDB (via Motor without tz_aware=True) returns datetime objects whose
 * .isoformat() produces strings like "2026-07-23T06:51:55" — no timezone
 * suffix.  JavaScript's `new Date("2026-07-23T06:51:55")` treats a string
 * with no suffix as *local time*, not UTC.  On a machine in IST (UTC+5:30)
 * that shifts every timestamp 5 h 30 min into the future relative to UTC,
 * making a ticket created "just now" appear "5 hours ago" or vice-versa.
 *
 * The backend serialisers now explicitly append "+00:00" before sending, but
 * this helper defends against any stragglers by detecting a bare ISO string
 * (no 'Z', no '+', no '-' after the time portion) and forcing UTC.
 */

/**
 * Parse an ISO string safely as UTC.
 * - If the string already carries a timezone offset (ends in Z, +HH:MM,
 *   or -HH:MM) it is left unchanged.
 * - If it is a bare "YYYY-MM-DDTHH:MM:SS[.ffffff]" it gets "Z" appended
 *   so JS treats it as UTC rather than local time.
 *
 * @param {string|null|undefined} iso
 * @returns {Date|null}
 */
export function parseUTCDate(iso) {
  if (!iso) return null;
  // Already has explicit offset?  e.g. "...+05:30", "...+00:00", "...Z"
  const hasOffset = /[Z+\-]\d{0,2}:?\d{0,2}$/.test(iso.trim()) ||
                    iso.trim().endsWith('Z');
  const normalized = hasOffset ? iso : iso + 'Z';
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Human-readable relative time: "just now", "3 min ago", "2 h ago", "5 d ago"
 * @param {string|null|undefined} iso
 * @returns {string}
 */
export function relativeTime(iso) {
  const d = parseUTCDate(iso);
  if (!d) return '';
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  return `${Math.floor(diff / 86400)} d ago`;
}

/**
 * Locale date string: "23 Jul 2026"
 * @param {string|null|undefined} iso
 * @returns {string}
 */
export function formatDate(iso) {
  const d = parseUTCDate(iso);
  if (!d) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

/**
 * Locale date+time string: "23 Jul 2026, 11:51 AM"
 * @param {string|null|undefined} iso
 * @returns {string}
 */
export function formatDateTime(iso) {
  const d = parseUTCDate(iso);
  if (!d) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

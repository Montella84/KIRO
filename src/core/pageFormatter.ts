import type { IncomingEvent } from './types';

/**
 * Replace any character with code point < 32 or > 126 with a space.
 * This keeps output within the printable ASCII range safe for LCD display.
 */
export function sanitize(text: string): string {
  // Iterate over Unicode code points (handles surrogate pairs correctly)
  return [...text]
    .map((ch) => {
      const cp = ch.codePointAt(0)!;
      return cp >= 32 && cp <= 126 ? ch : ' ';
    })
    .join('');
}

/**
 * Build a deterministic pager message string in the form "[CODE] SENDER: BODY",
 * sanitize it, and truncate to 80 characters.
 * Guaranteed to return a string of length 1–80 for any valid IncomingEvent.
 */
export function formatPage(event: IncomingEvent): string {
  const codeMap: Record<string, string> = {
    incident: '911',
    message:  '143',
    calendar: '411',
  };

  const code = codeMap[event.type] ?? '143';
  const candidate = `[${code}] ${event.sender}: ${event.body}`;
  const sanitized = sanitize(candidate);
  const truncated = sanitized.slice(0, 80);

  // Guard: return at least a single space if somehow empty (shouldn't happen for valid events)
  return truncated.length > 0 ? truncated : ' ';
}

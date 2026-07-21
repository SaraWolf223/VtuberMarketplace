/** Validates HTTPS destination URLs (client + shared checks). */
export function isValidHttpsUrl(link: string): boolean {
  const trimmed = link.trim();
  if (trimmed.length < 12) return false;
  try {
    const u = new URL(trimmed);
    return u.protocol === 'https:' && u.hostname.includes('.') && u.hostname.length > 3;
  } catch {
    return false;
  }
}

export function sanitizePriceInput(text: string): string {
  let cleaned = text.replace(/[^0-9.]/g, '');
  const dotIndex = cleaned.indexOf('.');
  if (dotIndex !== -1) {
    cleaned =
      cleaned.slice(0, dotIndex + 1) + cleaned.slice(dotIndex + 1).replace(/\./g, '').slice(0, 2);
  }

  return cleaned;
}

export function parsePriceInput(text: string): number | null {
  const num = Number.parseFloat(text);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

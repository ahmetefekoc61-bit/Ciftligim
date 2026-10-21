// Tarih ve sayı biçimleri. Backend tarihleri "YYYY-MM-DD" olarak bekler.

const pad = (n: number) => String(n).padStart(2, '0');

/** Date → "2026-10-21" (yerel saate göre) */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "2026-10-21" → Date (yerel gece yarısı) */
export function fromIsoDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function today(): string {
  return toIsoDate(new Date());
}

const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

/** "2026-10-21" ya da ISO zaman → "21 Eki 2026" */
export function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  const d = s.length <= 10 ? fromIsoDate(s) : new Date(s);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtDateTime(s: string | null | undefined): string {
  if (!s) return '—';
  const d = new Date(s);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 31 → "2 yıl 7 ay" */
export function fmtAge(months: number | null | undefined): string {
  if (months == null) return 'Yaş bilinmiyor';
  if (months < 1) return 'Yeni doğan';
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} ay`;
  return m === 0 ? `${y} yıl` : `${y} yıl ${m} ay`;
}

export function fmtNumber(n: number | null | undefined, digits = 1): string {
  if (n == null) return '—';
  return n.toLocaleString('tr-TR', { maximumFractionDigits: digits });
}

/** "12,5" ya da "12.5" → 12.5; boş/geçersiz → null */
export function parseNumber(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function daysUntil(isoDate: string): number {
  const ms = fromIsoDate(isoDate).getTime() - fromIsoDate(today()).getTime();
  return Math.round(ms / 86_400_000);
}

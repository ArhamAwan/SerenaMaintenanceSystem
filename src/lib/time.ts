// All timestamps are stored as UTC ISO strings and displayed in the property's timezone (Asia/Karachi, UTC+5, no DST).
export const TZ = 'Asia/Karachi';
const OFFSET = '+05:00';

export const nowIso = () => new Date().toISOString();

/** YYYY-MM-DD for a moment, in Karachi time */
export function pkDate(d: Date | string = new Date()): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** ISO instant for a Karachi local date + HH:mm */
export function pkAt(date: string, time = '09:00'): string {
  return new Date(`${date}T${time}:00${OFFSET}`).toISOString();
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00${OFFSET}`);
  d.setUTCDate(d.getUTCDate() + n);
  return pkDate(d);
}

export function addHours(iso: string, h: number): string {
  return new Date(new Date(iso).getTime() + h * 3600_000).toISOString();
}

export function addMinutes(iso: string, m: number): string {
  return new Date(new Date(iso).getTime() + m * 60_000).toISOString();
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T12:00:00${OFFSET}`).getTime() - new Date(`${a}T12:00:00${OFFSET}`).getTime()) / 86400_000);
}

export function fmtDate(iso?: string): string {
  if (!iso) return '—';
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00${OFFSET}`) : new Date(iso);
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

export function fmtDateShort(iso?: string): string {
  if (!iso) return '—';
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00${OFFSET}`) : new Date(iso);
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'short' }).format(d);
}

export function fmtTime(iso?: string): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

export function fmtDateTime(iso?: string): string {
  if (!iso) return '—';
  return `${fmtDate(iso)}, ${fmtTime(iso)}`;
}

export function weekday(date: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short' }).format(new Date(`${date}T12:00:00${OFFSET}`));
}

export function relative(iso?: string): string {
  if (!iso) return '—';
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const hrs = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  let s: string;
  if (mins < 1) return 'just now';
  if (mins < 60) s = `${mins} min`;
  else if (hrs < 36) s = `${hrs} h`;
  else s = `${days} d`;
  return diff < 0 ? `${s} ago` : `in ${s}`;
}

export function durationMin(a?: string, b?: string): number | null {
  if (!a || !b) return null;
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
}

export function fmtDuration(min: number | null): string {
  if (min === null) return '—';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 48) return m ? `${h} h ${m} min` : `${h} h`;
  return `${Math.round(h / 24)} d ${h % 24} h`;
}

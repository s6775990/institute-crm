// Display helpers (Hebrew, Israel time zone conventions of the browser).

const dateFmt = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' });
const weekdayFmt = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
const timeFmt = new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit' });

/** Parses YYYY-MM-DD as a local date (not UTC). */
export function parseDateOnly(d: string): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  return dateFmt.format(value.length === 10 ? parseDateOnly(value) : new Date(value));
}

/** "12.10.2026 בשעה 18:00" – avoids the comma that flips around in right-to-left text. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  return `${dateFmt.format(d)} בשעה ${timeFmt.format(d)}`;
}

export function formatTime(value: string): string {
  return timeFmt.format(new Date(value));
}

export function formatWeekday(value: string): string {
  return weekdayFmt.format(new Date(value));
}

export function todayDateOnly(): string {
  return toDateOnly(new Date());
}

export function toDateOnly(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Value for <input type="datetime-local"> in local time. */
export function toDateTimeLocal(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${toDateOnly(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "היום", "מחר", "אתמול" or the date. */
export function relativeDay(dateOnly: string): string {
  const diff = Math.round((parseDateOnly(dateOnly).getTime() - parseDateOnly(todayDateOnly()).getTime()) / 86_400_000);
  if (diff === 0) return 'היום';
  if (diff === 1) return 'מחר';
  if (diff === -1) return 'אתמול';
  return formatDate(dateOnly);
}

export function formatPhone(phone: string | null): string {
  if (!phone) return '';
  if (/^05\d{8}$/.test(phone)) return `${phone.slice(0, 3)}-${phone.slice(3)}`;
  if (/^0\d{8}$/.test(phone)) return `${phone.slice(0, 2)}-${phone.slice(2)}`;
  return phone;
}

/** Number in international format for WhatsApp links. */
export function whatsappNumber(phone: string): string {
  if (phone.startsWith('+')) return phone.slice(1);
  if (phone.startsWith('0')) return `972${phone.slice(1)}`;
  return phone;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} בתים`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} קילו`;
  return `${(bytes / 1024 / 1024).toFixed(1)} מגה`;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'בוקר טוב';
  if (h < 17) return 'צהריים טובים';
  if (h < 21) return 'ערב טוב';
  return 'לילה טוב';
}

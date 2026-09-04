/** Duration and date formatting. All stored timestamps are UTC epoch ms. */

/** 92 -> "01:32". Hours appear only when needed. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** 3480000 -> "58 min". Used for workout totals. */
export function formatMinutes(ms: number): string {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/** ISO weekday: 1 = Monday ... 7 = Sunday. */
export function todayDayOfWeek(): number {
  const js = new Date().getDay(); // 0 = Sunday
  return js === 0 ? 7 : js;
}

export function dayName(dow: number): string {
  return DAY_NAMES[dow - 1] ?? '';
}

export function dayShort(dow: number): string {
  return DAY_SHORT[dow - 1] ?? '';
}

export function monthName(monthIndex: number): string {
  return MONTHS[monthIndex] ?? '';
}

/** "3 Sep" */
export function formatShortDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${(MONTHS[d.getMonth()] ?? '').slice(0, 3)}`;
}

/** "Tuesday 3 September" */
export function formatLongDate(ms: number): string {
  const d = new Date(ms);
  const dow = d.getDay() === 0 ? 7 : d.getDay();
  return `${dayName(dow)} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "18:42" */
export function formatClock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "7d ago", "today", "yesterday" */
export function relativeDays(ms: number, now = Date.now()): string {
  const startOf = (t: number) => {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const days = Math.round((startOf(now) - startOf(ms)) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

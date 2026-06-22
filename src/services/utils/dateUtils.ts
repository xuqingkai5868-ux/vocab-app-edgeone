export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function subtractDays(date: Date, days: number): Date {
  return addDays(date, -days);
}

export function daysBetween(date1: Date, date2: Date): number {
  const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
  const diffMs = d1.getTime() - d2.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function isToday(date: Date): boolean {
  const today = new Date();
  return formatDate(date) === formatDate(today);
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return formatDate(date1) === formatDate(date2);
}

export function getMonthStart(year: number, month: number): Date {
  return new Date(year, month - 1, 1);
}

export function getMonthEnd(year: number, month: number): Date {
  return new Date(year, month, 0);
}

export function getMonthDays(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function getMonthStartDayOfWeek(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

export function getToday(): string {
  return formatDate(new Date());
}

export function getCurrentYear(): number {
  return new Date().getFullYear();
}

export function getCurrentMonth(): number {
  return new Date().getMonth() + 1;
}

export function getDateFromParts(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

export function formatTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}分钟`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
}

export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  return addDays(start, 6);
}

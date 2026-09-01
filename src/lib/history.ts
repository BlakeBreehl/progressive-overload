export const HISTORY_PAGE_SIZE = 20;
export const normalizeSearch = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
export const calendarDateKey = (value: string) =>
  /^(\d{4})-(\d{2})-(\d{2})/.exec(value)?.slice(1).join("-") ?? "";
export function calendarOrdinal(value: string) {
  const [year, month, day] = calendarDateKey(value).split("-").map(Number);
  return year * 10_000 + month * 100 + day;
}
export const compareCalendarAsc = (a: string, b: string) =>
  calendarOrdinal(a) - calendarOrdinal(b);
export const compareCalendarDesc = (a: string, b: string) =>
  compareCalendarAsc(b, a);
export const chronological = <T,>(items: T[], dateOf: (item: T) => string) =>
  [...items].sort((a, b) => compareCalendarAsc(dateOf(a), dateOf(b)));
export const newestFirst = <T,>(items: T[], dateOf: (item: T) => string) =>
  [...items].sort((a, b) => compareCalendarDesc(dateOf(a), dateOf(b)));
export const pageCount = (total: number, size = HISTORY_PAGE_SIZE) =>
  Math.max(1, Math.ceil(total / size));
export const validPage = (
  page: number,
  total: number,
  size = HISTORY_PAGE_SIZE,
) => Math.min(Math.max(1, page), pageCount(total, size));
export function paginate<T>(
  items: T[],
  page: number,
  size = HISTORY_PAGE_SIZE,
) {
  const current = validPage(page, items.length, size),
    start = (current - 1) * size;
  return {
    items: items.slice(start, start + size),
    page: current,
    pages: pageCount(items.length, size),
    total: items.length,
    start: items.length ? start + 1 : 0,
    end: Math.min(start + size, items.length),
  };
}
export function localDateLabel(value: string) {
  const [year, month, day] = calendarDateKey(value).split("-").map(Number);
  return new Date(year, month - 1, day, 12).toLocaleDateString();
}

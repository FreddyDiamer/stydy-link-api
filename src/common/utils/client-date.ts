import { isISO8601 } from 'class-validator';
import { BusinessException } from '../exceptions/business.exception';

/** Москва живёт по UTC+3 круглый год, без перехода на летнее время */
const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export const DEADLINE_IN_PAST_MESSAGE =
  'Срок уже прошёл — выберите сегодняшнюю или будущую дату';

/**
 * Дата с клиента → Date для Prisma.
 *
 * «2026-10-14» (так отдаёт <input type="date">) — конец этого дня по Москве,
 * как и у фронта, который шлёт конец выбранного дня. Полная ISO-8601 строка —
 * как есть. Всё остальное возвращается без изменений, чтобы @IsDate ответил
 * понятной ошибкой валидации, а не Prisma — ошибкой 500.
 */
export function parseClientDate(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const text = value.trim();
  if (DATE_ONLY.test(text)) {
    const [year, month, day] = text.split('-').map(Number);
    const calendar = new Date(Date.UTC(year, month - 1, day));
    // «2026-02-30» движок молча превращает в 2 марта — такую дату не принимаем
    if (
      calendar.getUTCFullYear() !== year ||
      calendar.getUTCMonth() !== month - 1 ||
      calendar.getUTCDate() !== day
    ) {
      return value;
    }
    return new Date(`${text}T23:59:59.999+03:00`);
  }
  // strict: isISO8601 сам отвергает несуществующие даты вроде 2026-02-30T…
  if (!isISO8601(text, { strict: true })) {
    return value;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? value : date;
}

/** Начало сегодняшнего дня по Москве */
export function startOfTodayInMoscow(now: Date = new Date()): Date {
  const moscow = new Date(now.getTime() + MOSCOW_OFFSET_MS);
  return new Date(
    Date.UTC(
      moscow.getUTCFullYear(),
      moscow.getUTCMonth(),
      moscow.getUTCDate(),
    ) - MOSCOW_OFFSET_MS,
  );
}

/** Срок не раньше начала сегодняшнего дня по Москве, иначе 400 */
export function assertDeadlineNotPast(
  date: Date | null | undefined,
  now: Date = new Date(),
): void {
  if (date && date.getTime() < startOfTodayInMoscow(now).getTime()) {
    throw new BusinessException(DEADLINE_IN_PAST_MESSAGE);
  }
}

/** Для update: проверяем срок, только если его меняют (тот же срок пропускаем) */
export function assertChangedDeadlineNotPast(
  next: Date | null | undefined,
  current: Date | null | undefined,
  now: Date = new Date(),
): void {
  if (next && next.getTime() !== current?.getTime()) {
    assertDeadlineNotPast(next, now);
  }
}

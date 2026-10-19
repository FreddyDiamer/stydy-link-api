import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsDate } from 'class-validator';
import { parseClientDate } from '../utils/client-date';

/**
 * Поле даты из запроса: в сервис приходит настоящий Date, а не строка.
 * Голый @IsDateString пропускал «2026-10-14», и Prisma падала на ней уже
 * после валидации. Принимает ГГГГ-ММ-ДД (конец дня по Москве) и полный ISO-8601.
 */
export const IsClientDate = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) => parseClientDate(value)),
    IsDate(),
  );

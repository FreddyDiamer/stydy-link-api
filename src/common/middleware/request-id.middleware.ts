import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'X-Request-Id';

/** Только безопасный формат: id попадает в логи и в ответ */
const VALID_INCOMING_ID = /^[\w-]{1,128}$/;

export type RequestWithId = Request & { requestId?: string };

/**
 * Сквозной id запроса: берётся из X-Request-Id, иначе генерируется. Уходит в
 * заголовок ответа и в тело любой ошибки, а для 500 — и в лог со стеком, чтобы
 * по номеру из сообщения пользователя найти запись в логах.
 */
export function requestIdMiddleware(
  req: RequestWithId,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.header(REQUEST_ID_HEADER);
  const requestId =
    incoming && VALID_INCOMING_ID.test(incoming) ? incoming : randomUUID();
  req.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}

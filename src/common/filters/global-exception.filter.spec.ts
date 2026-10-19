import { ArgumentsHost, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GlobalExceptionFilter } from './global-exception.filter';
import { NotFoundException } from '../exceptions/business.exception';
import { RequestValidationException } from '../pipes/validation.pipe';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url: '/api/x', method: 'POST', requestId: 'req-1' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('db error', {
    code,
    clientVersion: 'test',
  });

describe('GlobalExceptionFilter', () => {
  const filter = new GlobalExceptionFilter();

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('гонка на уникальном ключе (P2002) — 409, а не 500', () => {
    const { host, status, json } = hostFor();

    filter.catch(prismaError('P2002'), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 409, error: 'CONFLICT' }),
    );
  });

  it('исчезнувшая запись (P2025) — 404', () => {
    const { host, status } = hostFor();

    filter.catch(prismaError('P2025'), host);

    expect(status).toHaveBeenCalledWith(404);
  });

  it('прочие ошибки Prisma остаются 500', () => {
    const { host, status } = hostFor();

    filter.catch(prismaError('P1001'), host);

    expect(status).toHaveBeenCalledWith(500);
  });

  it('бизнес-ошибки отдаёт со своим кодом и статусом', () => {
    const { host, status, json } = hostFor();

    filter.catch(new NotFoundException('Deal', 'd-1'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'NOT_FOUND' }),
    );
  });

  it('неожиданная ошибка — 500 с русским текстом, requestId в ответе и в логе со стеком', () => {
    const { host, status, json } = hostFor();
    const log = jest.spyOn(Logger.prototype, 'error');
    const bug = new TypeError('boom');

    filter.catch(bug, host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        error: 'InternalServerError',
        message: 'Внутренняя ошибка сервера. Попробуйте позже',
        requestId: 'req-1',
      }),
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('boom'),
      bug.stack,
      expect.objectContaining({ requestId: 'req-1' }),
    );
  });

  it('PrismaClientValidationError — баг бэкенда: 500, а не 400', () => {
    const { host, status } = hostFor();

    filter.catch(
      new Prisma.PrismaClientValidationError('Invalid value for argument', {
        clientVersion: 'test',
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(500);
  });

  it('ошибка валидации — 400 с field и списком errors', () => {
    const { host, status, json } = hostFor();
    const errors = [
      { field: 'deadline', message: 'Срок: нужна дата' },
      { field: 'price', message: 'Цена: нужно число' },
    ];

    filter.catch(new RequestValidationException(errors), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'VALIDATION_ERROR',
        message: 'Срок: нужна дата',
        field: 'deadline',
        errors,
        requestId: 'req-1',
      }),
    );
  });
});

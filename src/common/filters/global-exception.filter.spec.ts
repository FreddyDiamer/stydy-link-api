import { ArgumentsHost, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GlobalExceptionFilter } from './global-exception.filter';
import { NotFoundException } from '../exceptions/business.exception';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url: '/api/x', method: 'POST' }),
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
});

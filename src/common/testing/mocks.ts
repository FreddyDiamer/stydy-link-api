/**
 * Заглушки для юнит-тестов сервисов: настоящая база в тестах не поднимается,
 * проверяем бизнес-правила, а не Prisma.
 */

export type MockedModel = Record<string, jest.Mock>;

const model = (): MockedModel => ({
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  findMany: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
  count: jest.fn(),
  groupBy: jest.fn(),
  aggregate: jest.fn(),
});

export interface DatabaseMock {
  deal: MockedModel;
  request: MockedModel;
  requestResponse: MockedModel;
  serviceResponse: MockedModel;
  service: MockedModel;
  review: MockedModel;
  user: MockedModel;
  subject: MockedModel;
  teacher: MockedModel;
  $transaction: jest.Mock;
}

export const createDatabaseMock = (): DatabaseMock => {
  const db: DatabaseMock = {
    deal: model(),
    request: model(),
    requestResponse: model(),
    serviceResponse: model(),
    service: model(),
    review: model(),
    user: model(),
    subject: model(),
    teacher: model(),
    // транзакция в тестах прозрачна: и колбэк, и массив промисов
    $transaction: jest.fn((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: DatabaseMock) => unknown)(db)
        : Promise.all(arg as Promise<unknown>[]),
    ),
  };
  return db;
};

const NOTIFY_METHODS = [
  'notifyServiceResponseCreated',
  'notifyServiceResponseAccepted',
  'notifyServiceResponseRejected',
  'notifyRequestResponseCreated',
  'notifyRequestResponseAccepted',
  'notifyRequestResponseRejected',
  'notifyDealCreated',
  'notifyDealAccepted',
  'notifyDealRejectedOrCancelled',
  'notifyDealCompleted',
  'notifyDealReopened',
  'notifyReviewCreated',
  'notifyReviewReply',
] as const;

/**
 * Уведомления fire-and-forget: в тестах только фиксируем факт вызова.
 * Объект явный, а не Proxy: Proxy отвечает функцией и на `then`,
 * из-за чего Nest принимает провайдер за промис и зависает на compile().
 */
export const createNotificationMock = (): Record<string, jest.Mock> =>
  Object.fromEntries(
    NOTIFY_METHODS.map((name) => [
      name,
      jest.fn().mockResolvedValue(undefined),
    ]),
  );

/** Типизированный доступ к аргументам вызова: без него линтер видит `any`. */
export const firstCallArg = <T>(mock: jest.Mock): T => {
  const calls = mock.mock.calls as unknown as unknown[][];
  return calls[0][0] as T;
};

/** Аргумент записи в Prisma: интересуют where и data. */
export interface WriteArg {
  where?: Record<string, unknown>;
  data: Record<string, unknown>;
}

/** Аргумент чтения из Prisma. */
export interface ReadArg {
  where: Record<string, unknown>;
}

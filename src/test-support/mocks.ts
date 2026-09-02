/**
 * Shared mocks for unit tests. Никогда не ходим в реальную базу:
 * `DatabaseService` подменяется объектом с jest-моками на каждую модель.
 */

type PrismaModelMock = {
  findUnique: jest.Mock;
  findFirst: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  updateMany: jest.Mock;
  upsert: jest.Mock;
  delete: jest.Mock;
  count: jest.Mock;
  aggregate: jest.Mock;
  groupBy: jest.Mock;
};

const MODELS = [
  'user',
  'group',
  'subject',
  'teacher',
  'teacherSubject',
  'service',
  'request',
  'serviceResponse',
  'requestResponse',
  'deal',
  'review',
] as const;

export type PrismaMock = Record<(typeof MODELS)[number], PrismaModelMock> & {
  $transaction: jest.Mock;
};

function createModelMock(): PrismaModelMock {
  return {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  };
}

export function createPrismaMock(): PrismaMock {
  const db = {
    // Прокидываем колбэк транзакции сам себя: тесты проверяют логику,
    // а не атомарность, которую обеспечивает Prisma
    $transaction: jest.fn((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: unknown) => unknown)(db)
        : Promise.all(arg as Promise<unknown>[]),
    ),
  } as PrismaMock;

  for (const model of MODELS) {
    db[model] = createModelMock();
  }

  return db;
}

/** Уведомления в тестах — заглушки: они fire-and-forget и не влияют на результат */
export function createNotificationMock() {
  return {
    notifyServiceResponseCreated: jest.fn().mockResolvedValue(undefined),
    notifyServiceResponseAccepted: jest.fn().mockResolvedValue(undefined),
    notifyServiceResponseRejected: jest.fn().mockResolvedValue(undefined),
    notifyRequestResponseCreated: jest.fn().mockResolvedValue(undefined),
    notifyRequestResponseAccepted: jest.fn().mockResolvedValue(undefined),
    notifyRequestResponseRejected: jest.fn().mockResolvedValue(undefined),
    notifyDealCreated: jest.fn().mockResolvedValue(undefined),
    notifyDealAccepted: jest.fn().mockResolvedValue(undefined),
    notifyDealRejectedOrCancelled: jest.fn().mockResolvedValue(undefined),
    notifyDealCompleted: jest.fn().mockResolvedValue(undefined),
    notifyReviewCreated: jest.fn().mockResolvedValue(undefined),
    notifyReviewReply: jest.fn().mockResolvedValue(undefined),
  };
}

/**
 * Ошибки в проекте несут машиночитаемый код (`BusinessException`), тексты —
 * русские и могут меняться, поэтому в тестах проверяем код и статус.
 */
export function expectBusinessError(
  fn: () => Promise<unknown>,
  expected: { code?: string; status?: number },
): Promise<void> {
  return fn().then(
    () => {
      throw new Error('Expected the call to reject, but it resolved');
    },
    (error: unknown) => {
      const err = error as {
        getStatus?: () => number;
        getResponse?: () => { error?: string };
      };
      if (typeof err.getStatus !== 'function') {
        throw error;
      }
      if (expected.status !== undefined) {
        expect(err.getStatus()).toBe(expected.status);
      }
      if (expected.code !== undefined) {
        expect(err.getResponse?.()?.error).toBe(expected.code);
      }
    },
  );
}

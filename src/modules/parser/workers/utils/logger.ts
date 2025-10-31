export function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    backoff?: boolean;
  } = {},
): Promise<T> {
  const { maxAttempts = 3, delay = 1000, backoff = true } = options;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = normalizeError(error);

      if (attempt === maxAttempts) {
        break;
      }

      const waitTime = backoff ? delay * attempt : delay;
      console.warn(
        `[ParserWorker] Попытка ${attempt}/${maxAttempts} не удалась. Повтор через ${waitTime}мс`,
      );

      await sleep(waitTime);
    }
  }

  throw lastError || new Error('Retry failed with unknown error');
}

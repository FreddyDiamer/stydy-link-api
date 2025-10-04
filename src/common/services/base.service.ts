import { Logger } from '@nestjs/common';

export abstract class BaseService {
  protected readonly logger = new Logger(this.constructor.name);

  protected logInfo(message: string, context?: object) {
    if (context) {
      this.logger.log(message, context);
    } else {
      this.logger.log(message);
    }
  }

  protected logError(message: string, error?: Error, context?: object) {
    if (context) {
      this.logger.error(message, error?.stack, context);
    } else if (error) {
      this.logger.error(message, error.stack);
    } else {
      this.logger.error(message);
    }
  }

  protected logWarn(message: string, context?: object) {
    if (context) {
      this.logger.warn(message, context);
    } else {
      this.logger.warn(message);
    }
  }

  protected logSuccess(message: string, context?: object) {
    if (context) {
      this.logger.log(`✅ ${message}`, context);
    } else {
      this.logger.log(`✅ ${message}`);
    }
  }

  protected normalizeError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    return new Error(String(error));
  }

  protected async retry<T>(
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
        lastError = this.normalizeError(error);

        if (attempt === maxAttempts) {
          break;
        }

        const waitTime = backoff ? delay * attempt : delay;
        this.logWarn(
          `Попытка ${attempt}/${maxAttempts} не удалась. Повтор через ${waitTime}мс`,
        );

        await this.sleep(waitTime);
      }
    }

    throw lastError || new Error('Retry failed with unknown error');
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

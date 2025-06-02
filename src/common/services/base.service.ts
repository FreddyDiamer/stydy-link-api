import { Logger } from '@nestjs/common';

export abstract class BaseService {
  protected readonly logger = new Logger(this.constructor.name);

  protected logInfo(message: string, context?: object) {
    this.logger.log(message, context);
  }

  protected logError(message: string, error?: Error, context?: object) {
    this.logger.error(message, error?.stack, context);
  }

  protected logWarn(message: string, context?: object) {
    this.logger.warn(message, context);
  }
}

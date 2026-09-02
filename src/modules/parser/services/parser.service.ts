import { HttpStatus, Injectable } from '@nestjs/common';
import { BaseService, BusinessException } from '@common';
import { Worker } from 'worker_threads';
import { resolve } from 'path';
import { ParseResultDto } from '../dto/parser-response.dto';

interface WorkerMessage {
  type: 'start';
}

interface WorkerResponse {
  success: boolean;
  data?: ParseResultDto;
  error?: string;
}

@Injectable()
export class ParserService extends BaseService {
  /** Не допускаем параллельных запусков тяжёлой синхронизации */
  private syncInProgress = false;

  async parseAndSync(): Promise<ParseResultDto> {
    if (this.syncInProgress) {
      throw new BusinessException(
        'Синхронизация уже выполняется',
        'PARSER_BUSY',
        HttpStatus.CONFLICT,
      );
    }
    this.syncInProgress = true;
    try {
      return await this.runWorker();
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Фоновый запуск: ошибка воркера логируется, а не остаётся
   * необработанным rejection (иначе падает весь процесс).
   */
  startBackgroundSync(): { message: string } {
    if (this.syncInProgress) {
      throw new BusinessException(
        'Синхронизация уже выполняется',
        'PARSER_BUSY',
        HttpStatus.CONFLICT,
      );
    }
    this.parseAndSync().catch((error: unknown) => {
      this.logError(
        'Фоновая синхронизация завершилась с ошибкой',
        this.normalizeError(error),
      );
    });
    return { message: 'Parsing started' };
  }

  private runWorker(): Promise<ParseResultDto> {
    return new Promise((resolvePromise, reject) => {
      const isProduction =
        process.env.NODE_ENV === 'production' || __dirname.includes('dist');
      const workerFileName = 'main-parser.worker.js';

      const workerPath = resolve(__dirname, '..', 'workers', workerFileName);

      const worker = new Worker(workerPath, {
        execArgv: isProduction
          ? []
          : ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register'],
      });

      const timeout = setTimeout(
        () => {
          void worker.terminate();
          reject(new Error('Parsing timeout'));
        },
        30 * 60 * 1000,
      );

      worker.on('message', (response: WorkerResponse) => {
        clearTimeout(timeout);
        void worker.terminate();

        if (response.success && response.data) {
          resolvePromise(response.data);
        } else {
          const error = new Error(response.error || 'Unknown parsing error');
          reject(error);
        }
      });

      worker.on('error', (error) => {
        clearTimeout(timeout);
        void worker.terminate();
        reject(error);
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          clearTimeout(timeout);
          const error = new Error(`Worker finished with code ${code}`);
          reject(error);
        }
      });

      worker.postMessage({ type: 'start' } as WorkerMessage);
    });
  }
}

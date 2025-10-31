import { Worker } from 'worker_threads';
import { resolve } from 'path';
import { normalizeError } from './logger';

export interface WorkerTask {
  type: 'getTeachers' | 'getGroups' | 'getSchedule';
  query?: string;
  groupId?: string;
  programForm?: string;
}

export interface WorkerResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class WorkerParserPool {
  private workers: Worker[] = [];
  private readonly poolSize: number;
  private currentWorkerIndex = 0;

  constructor(poolSize: number) {
    this.poolSize = poolSize;
    this.initializeWorkers();
  }

  private initializeWorkers(): void {
    const isProduction =
      process.env.NODE_ENV === 'production' || __dirname.includes('dist');
    const workerFileName = 'parser.worker.js';

    const workerPath = resolve(__dirname, '..', workerFileName);

    for (let i = 0; i < this.poolSize; i++) {
      try {
        const worker = new Worker(workerPath, {
          execArgv: isProduction
            ? []
            : ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register'],
        });

        worker.on('error', (error) => {
          const err = normalizeError(error);
          throw err;
        });

        worker.on('exit', (code) => {
          if (code !== 0) {
            const err = new Error(`Воркер ${i} остановлен с кодом ${code}`);
            throw err;
          }
        });

        this.workers.push(worker);
      } catch (error) {
        const err = normalizeError(error);
        throw err;
      }
    }
  }

  async executeTask<T>(task: WorkerTask): Promise<T> {
    return new Promise((resolve, reject) => {
      const worker = this.getNextWorker();

      if (!worker) {
        const err = new Error('Нет доступных воркеров');
        reject(err);
        return;
      }

      const timeout = setTimeout(() => {
        worker.off('message', messageHandler);
        const err = new Error(`Timeout for task: ${task.type}`);
        reject(err);
      }, 60000);

      const messageHandler = (response: WorkerResponse<T>) => {
        clearTimeout(timeout);
        worker.off('message', messageHandler);

        if (response.success && response.data !== undefined) {
          resolve(response.data);
        } else {
          const err = new Error(response.error || 'Unknown error');
          reject(err);
        }
      };

      worker.on('message', messageHandler);
      worker.postMessage(task);
    });
  }

  private getNextWorker(): Worker | undefined {
    if (this.workers.length === 0) {
      return undefined;
    }

    const worker = this.workers[this.currentWorkerIndex];
    this.currentWorkerIndex = (this.currentWorkerIndex + 1) % this.poolSize;
    return worker;
  }

  async shutdown(): Promise<void> {
    await Promise.all(
      this.workers.map((worker) => {
        return new Promise<void>((resolve) => {
          worker.on('exit', () => {
            resolve();
          });

          void worker.terminate();
        });
      }),
    );
    this.workers = [];
  }
}

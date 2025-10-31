import { parentPort } from 'worker_threads';
import { PrismaClient } from '@prisma/client';
import { ParseResultDto } from '../dto/parser-response.dto';
import { MainParser } from './utils/main-parser';

interface WorkerMessage {
  type: 'start';
}

interface WorkerResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const db = new PrismaClient();

parentPort?.on('message', (message: WorkerMessage) => {
  if (message.type === 'start') {
    void (async () => {
      try {
        await db.$connect();
        console.log('[ParserWorker] Database connection established');

        const parser = new MainParser(db);
        const result = await parser.parseAndSync();

        parentPort?.postMessage({
          success: true,
          data: result,
        } as WorkerResponse<ParseResultDto>);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error('[ParserWorker] Error during parsing', err);
        parentPort?.postMessage({
          success: false,
          error: err.message,
        } as WorkerResponse<ParseResultDto>);
      } finally {
        process.exit(0);
      }
    })();
  }
});

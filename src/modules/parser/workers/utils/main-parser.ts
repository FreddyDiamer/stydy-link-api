import { GroupDto } from '../../dto/parsed-data.dto';
import { ParseResultDto, ParseStatus } from '../../dto/parser-response.dto';
import { PrismaClient } from '@prisma/client';
import { WorkerSyncService } from './sync-service';
import { KaiApiClient } from './kai-api-client';
import { retry, normalizeError, sleep } from './logger';
import { normalizeSubjectName } from './subject-name';

export class MainParser {
  private result: ParseResultDto;
  private apiClient: KaiApiClient;
  private syncService: WorkerSyncService;

  private readonly config = {
    concurrency: {
      limit: 5,
    },
    rateLimit: {
      delayBetweenBatches: 0,
    },
    retry: {
      maxAttempts: 3,
      delay: 500,
    },
    timeout: {
      request: 30000,
    },
  };

  constructor(private readonly db: PrismaClient) {
    this.apiClient = new KaiApiClient();
    this.syncService = new WorkerSyncService(db);
  }

  async parseAndSync(): Promise<ParseResultDto> {
    this.initializeResult();

    try {
      console.log('[ParserWorker] Starting parsing and sync...');

      await Promise.all([this.processTeachers(), this.processGroups()]);

      await this.processRelations();
      this.completeResult();

      console.log(
        `[ParserWorker] Completed: ${this.result.teachersProcessed} teachers, ${this.result.groupsProcessed} groups, ${this.result.subjectsProcessed} subjects, ${this.result.relationsProcessed} relations`,
      );

      return this.result;
    } catch (error) {
      this.handleError(error);
      throw error;
    } finally {
      await this.db.$disconnect();
    }
  }

  async processRelations(): Promise<void> {
    const [teachers, groups] = await Promise.all([
      this.syncService.getAllTeachers(),
      this.syncService.getAllGroups(),
    ]);

    const teacherCache = new Map(teachers.map((t) => [t.foreignId, t]));
    const allSubjects = new Set<string>();
    const allRelations: Map<
      string,
      { teacherId: string; subjectName: string }[]
    > = new Map();

    await this.processBatch(
      groups,
      async (group) => {
        try {
          const groupData = JSON.parse(group.data as string) as GroupDto;
          const groupSchedule = await retry(
            () => this.apiClient.getSchedule(group.foreignId, groupData.forma),
            {
              maxAttempts: this.config.retry.maxAttempts,
              delay: this.config.retry.delay,
            },
          );

          const relations: { teacherId: string; subjectName: string }[] = [];

          for (const schedule of groupSchedule) {
            const subjectName = normalizeSubjectName(schedule.disciplName);
            if (!subjectName) {
              continue;
            }
            allSubjects.add(subjectName);

            const teacher = teacherCache.get(schedule.prepodLogin);
            if (!teacher) {
              continue;
            }

            relations.push({
              teacherId: teacher.id,
              subjectName,
            });
          }

          allRelations.set(group.id, relations);
          return relations.length;
        } catch (error) {
          const err = normalizeError(error);
          this.incrementErrorCount(err.message);
          return 0;
        }
      },
      (count) => {
        this.result.relationsProcessed += count;
      },
      (batchIndex, totalBatches, processed) => {
        console.log(
          `[ParserWorker] Relations batch ${batchIndex}/${totalBatches}: ${processed} processed`,
        );
      },
    );

    this.result.subjectsProcessed = allSubjects.size;
    if (allSubjects.size > 0) {
      await this.syncService.syncSubjectsBatch(Array.from(allSubjects));
    }

    if (allRelations.size > 0) {
      await this.syncService.syncRelationsBatch(allRelations);
    }
  }

  async processGroups(): Promise<void> {
    const numbers = '1234567890';
    const queries = numbers.split('');

    await this.processBatch(
      queries,
      async (number) => {
        try {
          const groups = await retry(() => this.apiClient.getGroups(number), {
            maxAttempts: this.config.retry.maxAttempts,
            delay: this.config.retry.delay,
          });

          if (groups.length === 0) {
            return 0;
          }

          const synced = await this.syncService.syncGroups(groups);
          return synced;
        } catch (error) {
          const err = normalizeError(error);
          this.incrementErrorCount(err.message);
          return 0;
        }
      },
      (count) => {
        this.result.groupsProcessed += count;
      },
      (batchIndex, totalBatches, processed) => {
        console.log(
          `[ParserWorker] Groups batch ${batchIndex}/${totalBatches}: ${processed} synced`,
        );
      },
    );
  }

  async processTeachers(): Promise<void> {
    const alphabets = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
    const queries = alphabets.split('');

    await this.processBatch(
      queries,
      async (letter) => {
        try {
          const teachers = await retry(
            () => this.apiClient.getTeachers(letter),
            {
              maxAttempts: this.config.retry.maxAttempts,
              delay: this.config.retry.delay,
            },
          );

          if (teachers.length === 0) {
            return 0;
          }

          const synced = await this.syncService.syncTeachers(teachers);
          return synced;
        } catch (error) {
          const err = normalizeError(error);
          this.incrementErrorCount(err.message);
          return 0;
        }
      },
      (count) => {
        this.result.teachersProcessed += count;
      },
      (batchIndex, totalBatches, processed) => {
        console.log(
          `[ParserWorker] Teachers batch ${batchIndex}/${totalBatches}: ${processed} synced`,
        );
      },
    );
  }

  private async processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    onResult: (result: R) => void,
    onBatchComplete?: (
      batchIndex: number,
      totalBatches: number,
      processed: number,
    ) => void,
  ): Promise<void> {
    const totalBatches = Math.ceil(
      items.length / this.config.concurrency.limit,
    );
    let batchIndex = 0;

    for (let i = 0; i < items.length; i += this.config.concurrency.limit) {
      batchIndex++;
      const batch = items.slice(i, i + this.config.concurrency.limit);
      const batchResults = await Promise.all(batch.map(processor));

      let batchProcessed = 0;
      batchResults.forEach((result) => {
        onResult(result);
        batchProcessed += Number(result) || 0;
      });

      if (onBatchComplete) {
        onBatchComplete(batchIndex, totalBatches, batchProcessed);
      }

      if (this.config.rateLimit.delayBetweenBatches > 0) {
        await sleep(this.config.rateLimit.delayBetweenBatches);
      }
    }
  }

  private initializeResult(): void {
    this.result = {
      startTime: new Date(),
      endTime: undefined,
      duration: 0,
      status: ParseStatus.RUNNING,
      teachersProcessed: 0,
      groupsProcessed: 0,
      subjectsProcessed: 0,
      relationsProcessed: 0,
      errorCount: 0,
      errors: [],
    };
  }

  private completeResult(): void {
    this.result.status = ParseStatus.COMPLETED;
    this.result.endTime = new Date();
    this.result.duration = this.calculateDuration();
  }

  private handleError(error: unknown): void {
    const err = normalizeError(error);
    this.result.status = ParseStatus.FAILED;
    this.result.endTime = new Date();
    this.result.duration = this.calculateDuration();
    this.incrementErrorCount(err.message);
  }

  private incrementErrorCount(errorMessage: string): void {
    this.result.errorCount += 1;
    if (!this.result.errors.includes(errorMessage)) {
      this.result.errors.push(errorMessage);
    }
  }

  private calculateDuration(): number {
    if (!this.result.endTime) return 0;
    return (
      (this.result.endTime.getTime() - this.result.startTime.getTime()) / 1000
    );
  }
}

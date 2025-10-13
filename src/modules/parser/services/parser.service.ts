import { Injectable } from '@nestjs/common';
import { BaseService } from '@common';

import {
  GroupDto,
  TeacherDto,
  ScheduleLessonDto,
} from '../dto/parsed-data.dto';
import { ParseResultDto, ParseStatus } from '../dto/parser-response.dto';
import { SyncService } from './sync.service';

@Injectable()
export class ParserService extends BaseService {
  private result: ParseResultDto;

  private readonly config = {
    // count of parallel requests
    concurrency: {
      limit: 5,
    },
    // delay between batches
    rateLimit: {
      delayBetweenBatches: 0,
    },
    // retry settings
    retry: {
      maxAttempts: 3,
      delay: 500,
    },
    // request timeout
    timeout: {
      request: 30000,
    },
  };

  constructor(private readonly syncService: SyncService) {
    super();
  }

  async parseAndSync(): Promise<ParseResultDto> {
    this.initializeResult();

    try {
      this.logInfo('🚀 Запуск парсинга и синхронизации');

      await Promise.all([this.processTeachers(), this.processGroups()]);

      await this.processRelations();
      this.completeResult();
      this.logSuccess(
        `Синхронизация завершена: ${this.result.teachersProcessed} преподавателей, ` +
          `${this.result.groupsProcessed} групп за ${this.result.duration} сек`,
      );

      return this.result;
    } catch (error) {
      this.handleError(error);
      throw error;
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
          const groupSchedule = await this.retry(
            () => this.getSchedule(group.foreignId, groupData.forma),
            {
              maxAttempts: this.config.retry.maxAttempts,
              delay: this.config.retry.delay,
            },
          );

          const relations: { teacherId: string; subjectName: string }[] = [];

          for (const schedule of groupSchedule) {
            allSubjects.add(schedule.disciplName);

            const teacher = teacherCache.get(schedule.prepodLogin);
            if (!teacher) {
              this.logWarn(`Преподаватель не найден: ${schedule.prepodLogin}`);
              continue;
            }

            relations.push({
              teacherId: teacher.id,
              subjectName: schedule.disciplName,
            });
          }

          allRelations.set(group.id, relations);
          return relations.length;
        } catch (error) {
          const err = this.normalizeError(error);
          this.logError(`Ошибка обработки группы ${group.id}`, err);
          this.incrementErrorCount(err.message);
          return 0;
        }
      },
      (count) => {
        this.result.subjectsProcessed += count;
      },
    );

    if (allSubjects.size > 0) {
      this.logInfo(`📚 Синхронизация ${allSubjects.size} уникальных предметов`);
      await this.syncService.syncSubjectsBatch(Array.from(allSubjects));
    }

    if (allRelations.size > 0) {
      this.logInfo(`🔄 Синхронизация связей для ${allRelations.size} групп`);
      await this.syncService.syncRelationsBatch(allRelations);
    }

    this.logSuccess(
      `Обработка связей завершена: ${allSubjects.size} предметов, ${allRelations.size} групп`,
    );
  }

  async processGroups(): Promise<void> {
    const numbers = '1234567890';
    const queries = numbers.split('');

    this.logInfo(`📚 Начало парсинга групп по ${queries.length} запросам`);

    await this.processBatch(
      queries,
      async (number) => {
        try {
          const groups = await this.retry(() => this.getGroups(number), {
            maxAttempts: this.config.retry.maxAttempts,
            delay: this.config.retry.delay,
          });

          if (groups.length === 0) {
            return 0;
          }

          const synced = await this.syncService.syncGroups(groups);
          this.logInfo(
            `✓ Группы на "${number}": парсировано ${groups.length}, синхронизировано ${synced}`,
          );
          return synced;
        } catch (error) {
          const err = this.normalizeError(error);
          this.logError(`Ошибка обработки групп "${number}"`, err);
          this.incrementErrorCount(err.message);
          return 0;
        }
      },
      (count) => {
        this.result.groupsProcessed += count;
      },
    );

    this.logSuccess(
      `Парсинг групп завершен: ${this.result.groupsProcessed} записей`,
    );
  }

  async processTeachers(): Promise<void> {
    const alphabets = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
    const queries = alphabets.split('');

    this.logInfo(
      `👨‍🏫 Начало парсинга преподавателей по ${queries.length} запросам`,
    );

    await this.processBatch(
      queries,
      async (letter) => {
        try {
          const teachers = await this.retry(() => this.getTeachers(letter), {
            maxAttempts: this.config.retry.maxAttempts,
            delay: this.config.retry.delay,
          });

          if (teachers.length === 0) {
            return 0;
          }

          const synced = await this.syncService.syncTeachers(teachers);
          this.logInfo(
            `✓ Преподаватели на "${letter}": парсировано ${teachers.length}, синхронизировано ${synced}`,
          );
          return synced;
        } catch (error) {
          const err = this.normalizeError(error);
          this.logError(`Ошибка обработки преподавателей "${letter}"`, err);
          this.incrementErrorCount(err.message);
          return 0;
        }
      },
      (count) => {
        this.result.teachersProcessed += count;
      },
    );

    this.logSuccess(
      `Парсинг преподавателей завершен: ${this.result.teachersProcessed} записей`,
    );
  }

  private async processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    onResult: (result: R) => void,
  ): Promise<void> {
    for (let i = 0; i < items.length; i += this.config.concurrency.limit) {
      const batch = items.slice(i, i + this.config.concurrency.limit);
      const batchResults = await Promise.all(batch.map(processor));
      if (this.config.rateLimit.delayBetweenBatches > 0) {
        await this.delay(this.config.rateLimit.delayBetweenBatches);
      }
      batchResults.forEach(onResult);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getTeachers(query: string = ''): Promise<TeacherDto[]> {
    const url = 'https://kai.ru/for-staff/raspisanie';

    const params = new URLSearchParams({
      p_p_id: 'pubLecturerSchedule_WAR_publicLecturerSchedule10',
      p_p_lifecycle: '2',
      p_p_resource_id: 'getLecturersURL',
      query,
    });

    try {
      const response = await fetch(`${url}?${params}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: 'https://kai.ru/for-staff/raspisanie',
        },
      });

      if (response.status === 404) {
        return [];
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const data = await response.json();

      if (!Array.isArray(data)) {
        this.logWarn(
          `Неожиданный формат данных для запроса "${query}": ${typeof data}`,
        );
        return [];
      }

      return data as TeacherDto[];
    } catch (error) {
      const err = this.normalizeError(error);
      throw err;
    }
  }

  async getGroups(query: string = ''): Promise<GroupDto[]> {
    const url = 'https://kai.ru/web/studentu/raspisanie1';

    const params = new URLSearchParams({
      p_p_id: 'pubStudentSchedule_WAR_publicStudentSchedule10',
      p_p_lifecycle: '2',
      p_p_resource_id: 'getGroupsURL',
      query,
    });

    try {
      const response = await fetch(`${url}?${params}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: 'https://kai.ru/web/studentu/raspisanie1',
        },
      });

      if (response.status === 404) {
        return [];
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const data = await response.json();

      if (!Array.isArray(data)) {
        this.logWarn(
          `Неожиданный формат данных для запроса "${query}": ${typeof data}`,
        );
        return [];
      }

      return data as GroupDto[];
    } catch (error) {
      const err = this.normalizeError(error);
      throw err;
    }
  }

  async getSchedule(
    groupId: string,
    programForm: string,
  ): Promise<ScheduleLessonDto[]> {
    const url = 'https://kai.ru/web/studentu/raspisanie1';

    const params = new URLSearchParams({
      p_p_id: 'pubStudentSchedule_WAR_publicStudentSchedule10',
      p_p_lifecycle: '2',
      p_p_resource_id: 'schedule',
    });

    const body = new URLSearchParams();
    body.append('groupId', groupId);
    body.append('programForm', programForm);

    try {
      const response = await fetch(`${url}?${params}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: 'https://kai.ru/web/studentu/raspisanie1',
        },
        body: body.toString(),
      });

      if (response.status === 404) {
        return [];
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await response.json();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      return Object.values(result).flat() as ScheduleLessonDto[];
    } catch (error) {
      const err = this.normalizeError(error);
      this.logError(`Ошибка получения расписания для группы ${groupId}`, err);
      return [];
    }
  }

  /**
   * Инициализация результата
   */
  private initializeResult(): void {
    this.result = {
      startTime: new Date(),
      endTime: undefined,
      duration: 0,
      status: ParseStatus.RUNNING,
      teachersProcessed: 0,
      groupsProcessed: 0,
      subjectsProcessed: 0,
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
    const err = this.normalizeError(error);
    this.result.status = ParseStatus.FAILED;
    this.result.endTime = new Date();
    this.result.duration = this.calculateDuration();
    this.incrementErrorCount(err.message);
    this.logError('❌ Фатальная ошибка при парсинге и синхронизации', err);
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

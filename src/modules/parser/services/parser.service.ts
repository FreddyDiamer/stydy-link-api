import { Injectable } from '@nestjs/common';
import { BaseService } from '@common';
import axios from 'axios';

import { ParsedGroupDto, ParsedTeacherDto } from '../dto/parsed-data.dto';
import { ParseResultDto, ParseStatus } from '../dto/parser-response.dto';
import { SyncService } from './sync.service';

@Injectable()
export class ParserService extends BaseService {
  private result: ParseResultDto;
  private readonly CONCURRENCY_LIMIT = 5;

  constructor(private readonly syncService: SyncService) {
    super();
  }

  async parseAndSync(): Promise<ParseResultDto> {
    this.initializeResult();

    try {
      this.logInfo('🚀 Запуск парсинга и синхронизации');

      await Promise.all([this.processTeachers(), this.processGroups()]);

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

  async processGroups(): Promise<void> {
    const numbers = '1234567890';
    const queries = numbers.split('');

    this.logInfo(`📚 Начало парсинга групп по ${queries.length} запросам`);

    await this.processBatch(
      queries,
      async (number) => {
        try {
          const groups = await this.retry(() => this.getGroups(number), {
            maxAttempts: 3,
            delay: 500,
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
            maxAttempts: 3,
            delay: 500,
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
    for (let i = 0; i < items.length; i += this.CONCURRENCY_LIMIT) {
      const batch = items.slice(i, i + this.CONCURRENCY_LIMIT);
      const batchResults = await Promise.all(batch.map(processor));
      batchResults.forEach(onResult);
    }
  }

  async getTeachers(query: string = ''): Promise<ParsedTeacherDto[]> {
    const url = 'https://kai.ru/for-staff/raspisanie';

    const params = new URLSearchParams({
      p_p_id: 'pubLecturerSchedule_WAR_publicLecturerSchedule10',
      p_p_lifecycle: '2',
      p_p_resource_id: 'getLecturersURL',
      query,
    });

    try {
      const response = await axios.get(`${url}?${params}`, {
        headers: {
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: 'https://kai.ru/for-staff/raspisanie',
        },
        timeout: 30000,
      });

      if (!Array.isArray(response.data)) {
        this.logWarn(
          `Неожиданный формат данных для запроса "${query}": ${typeof response.data}`,
        );
        return [];
      }

      return response.data as ParsedTeacherDto[];
    } catch (error) {
      const err = this.normalizeError(error);
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return [];
      }
      throw err;
    }
  }

  async getGroups(query: string = ''): Promise<ParsedGroupDto[]> {
    const url = 'https://kai.ru/web/studentu/raspisanie1';

    const params = new URLSearchParams({
      p_p_id: 'pubStudentSchedule_WAR_publicStudentSchedule10',
      p_p_lifecycle: '2',
      p_p_resource_id: 'getGroupsURL',
      query,
    });

    try {
      const response = await axios.get(`${url}?${params}`, {
        headers: {
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: 'https://kai.ru/web/studentu/raspisanie1',
        },
        timeout: 30000,
      });

      if (!Array.isArray(response.data)) {
        this.logWarn(
          `Неожиданный формат данных для запроса "${query}": ${typeof response.data}`,
        );
        return [];
      }

      return response.data as ParsedGroupDto[];
    } catch (error) {
      const err = this.normalizeError(error);
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return [];
      }
      throw err;
    }
  }

  // /**
  //  * Создание списка предметов на основе данных преподавателей и групп
  //  */
  // async parseSubjects(
  //   teachers: ParsedTeacherDto[],
  //   groups: ParsedGroupDto[],
  // ): Promise<ParsedSubjectDto[]> {
  //   this.logInfo('Формируем список предметов из данных преподавателей и групп');

  //   const subjectsMap = new Map<string, ParsedSubjectDto>();

  //   // Собираем предметы от преподавателей
  //   teachers.forEach((teacher) => {
  //     teacher.subjects.forEach((subjectName) => {
  //       if (!subjectsMap.has(subjectName)) {
  //         subjectsMap.set(subjectName, {
  //           name: subjectName,
  //           teacherIds: [],
  //           groupIds: [],
  //         });
  //       }

  //       const subject = subjectsMap.get(subjectName)!;
  //       if (!subject.teacherIds.includes(teacher.foreignId)) {
  //         subject.teacherIds.push(teacher.foreignId);
  //       }
  //     });
  //   });

  //   // Добавляем связи с группами
  //   groups.forEach((group) => {
  //     group.subjects.forEach((subjectName) => {
  //       if (!subjectsMap.has(subjectName)) {
  //         subjectsMap.set(subjectName, {
  //           name: subjectName,
  //           teacherIds: [],
  //           groupIds: [],
  //         });
  //       }

  //       const subject = subjectsMap.get(subjectName)!;
  //       if (!subject.groupIds.includes(group.foreignId)) {
  //         subject.groupIds.push(group.foreignId);
  //       }
  //     });
  //   });

  //   const subjects = Array.from(subjectsMap.values());
  //   this.logInfo(`Сформировано предметов: ${subjects.length}`);

  //   return subjects;
  // }

  // /**
  //  * Тестовые данные для разработки
  //  */
  // private getMockTeachers(): ParsedTeacherDto[] {
  //   return [
  //     {
  //       fullName: 'Иванов Иван Иванович',
  //       foreignId: 'TEACHER_001',
  //       subjects: ['Математика', 'Алгебра'],
  //     },
  //     {
  //       fullName: 'Петров Петр Петрович',
  //       foreignId: 'TEACHER_002',
  //       subjects: ['Физика', 'Механика'],
  //     },
  //     {
  //       fullName: 'Сидорова Анна Александровна',
  //       foreignId: 'TEACHER_003',
  //       subjects: ['Химия', 'Органическая химия'],
  //     },
  //   ];
  // }

  // private getMockGroups(): ParsedGroupDto[] {
  //   return [
  //     {
  //       number: '4312',
  //       foreignId: 'GROUP_4312',
  //       educationForm: 'Очная',
  //       subjects: ['Математика', 'Физика', 'Химия'],
  //     },
  //     {
  //       number: '4313',
  //       foreignId: 'GROUP_4313',
  //       educationForm: 'Очная',
  //       subjects: ['Математика', 'Физика'],
  //     },
  //     {
  //       number: '4314',
  //       foreignId: 'GROUP_4314',
  //       educationForm: 'Заочная',
  //       subjects: ['Алгебра', 'Механика'],
  //     },
  //   ];
  // }

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

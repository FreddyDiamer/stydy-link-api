import { Injectable } from '@nestjs/common';
import { BaseService } from '@common';
import axios from 'axios';

import { ParsedGroupDto, ParsedTeacherDto } from '../dto/parsed-data.dto';
import { ParseResultDto, ParseStatus } from '../dto/parser-response.dto';
import { SyncService } from './sync.service';

@Injectable()
export class ParserService extends BaseService {
  private result: ParseResultDto;

  constructor(private readonly syncService: SyncService) {
    super();
  }
  async parseAndSync(): Promise<ParseResultDto> {
    this.initializeResult();

    try {
      // Парсим данные
      await Promise.all([this.processTeachers(), this.processGroups()]);
      this.completeResult();
      // const subjects = await this.parseSubjects(teachers, groups);

      // Синхронизируем с БД
      // await this.syncService.syncTeachers(teachers);
      // await this.syncService.syncGroups(groups);
      // await this.syncService.syncSubjects(subjects);
      // await this.syncService.syncRelations(teachers, groups, subjects);

      // result.teachersProcessed = teachers.length;
      // result.groupsProcessed = groups.length;
      // result.subjectsProcessed = subjects.length;
      // result.status = ParseStatus.COMPLETED;
      // result.endTime = new Date();

      this.logInfo('Синхронизация завершена успешно', this.result);

      return this.result;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }
  async processGroups(): Promise<void> {
    const numbers = '1234567890';

    await Promise.all(
      numbers.split('').map(async (number) => {
        const groups: ParsedGroupDto[] = await this.getGroups(number);
        if (groups.length === 0) {
          return;
        }
        await this.syncService.syncGroups(groups);
        this.result.groupsProcessed += groups.length;
      }),
    );
  }

  async processTeachers(): Promise<void> {
    const alphabets = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
    await Promise.all(
      alphabets.split('').map(async (letter) => {
        const teachers: ParsedTeacherDto[] = await this.getTeachers(letter);
        if (teachers.length === 0) {
          return;
        }
        await this.syncService.syncTeachers(teachers);
        this.result.teachersProcessed += teachers.length;
      }),
    );
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

      return response.data as ParsedTeacherDto[];
    } catch (error) {
      this.logError('Ошибка при получении преподавателей:', error as Error);
      return [];
    }
  }

  /**
   * Парсинг групп с сайта университета
   */
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
        method: 'GET',
        headers: {
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: 'https://kai.ru/web/studentu/raspisanie1',
        },
      });

      if (response.status !== 200) {
        throw new Error(`HTTP error! status: ${response.statusText}`);
      }

      const data = response.data as ParsedGroupDto[];
      return data;
    } catch (error) {
      this.logError('Ошибка при получении групп:', error as Error);
      return [];
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
    this.result.status = ParseStatus.FAILED;
    this.result.endTime = new Date();
    this.result.duration = this.calculateDuration();
    this.result.errorCount += 1;
    this.result.errors.push(
      error instanceof Error ? error.message : String(error),
    );
    this.logError('Ошибка при парсинге и синхронизации', error as Error);
  }

  private calculateDuration(): number {
    if (!this.result.endTime) return 0;
    return (
      (this.result.endTime.getTime() - this.result.startTime.getTime()) / 1000
    );
  }
}

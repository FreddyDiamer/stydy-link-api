import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { BaseService, BusinessException } from '@common';
import { ParsedTeacherDto, ParsedGroupDto } from '../dto/parsed-data.dto';

@Injectable()
export class SyncService extends BaseService {
  constructor(private readonly db: DatabaseService) {
    super();
  }

  async syncTeachers(teachers: ParsedTeacherDto[]): Promise<number> {
    if (teachers.length === 0) return 0;

    try {
      return await this.retry(
        async () => {
          return await this.db.$transaction(
            async (tx) => {
              return await this.syncTeachersInTx(tx, teachers);
            },
            {
              maxWait: 5000,
              timeout: 30000,
            },
          );
        },
        { maxAttempts: 2, delay: 1000 },
      );
    } catch (error) {
      const err = this.normalizeError(error);
      this.logError(
        `Ошибка при синхронизации ${teachers.length} преподавателей`,
        err,
      );
      throw new BusinessException('Не удалось синхронизировать преподавателей');
    }
  }

  async syncGroups(groups: ParsedGroupDto[]): Promise<number> {
    if (groups.length === 0) return 0;

    try {
      return await this.retry(
        async () => {
          return await this.db.$transaction(
            async (tx) => {
              return await this.syncGroupsInTx(tx, groups);
            },
            {
              maxWait: 5000,
              timeout: 30000,
            },
          );
        },
        { maxAttempts: 2, delay: 1000 },
      );
    } catch (error) {
      const err = this.normalizeError(error);
      this.logError(`Ошибка при синхронизации ${groups.length} групп`, err);
      throw new BusinessException('Не удалось синхронизировать группы');
    }
  }

  private async syncTeachersInTx(
    tx: any,
    teachers: ParsedTeacherDto[],
  ): Promise<number> {
    let syncedCount = 0;
    const chunkSize = 100;

    for (let i = 0; i < teachers.length; i += chunkSize) {
      const chunk = teachers.slice(i, i + chunkSize);

      await Promise.all(
        chunk.map((teacher) =>
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
          tx.teacher.upsert({
            where: { foreignId: teacher.id },
            update: {
              fullName: teacher.lecturer,
              data: JSON.stringify(teacher),
              updatedAt: new Date(),
            },
            create: {
              fullName: teacher.lecturer,
              foreignId: teacher.id,
              data: JSON.stringify(teacher),
            },
          }),
        ),
      );

      syncedCount += chunk.length;
    }

    return syncedCount;
  }

  private async syncGroupsInTx(
    tx: any,
    groups: ParsedGroupDto[],
  ): Promise<number> {
    let syncedCount = 0;
    const chunkSize = 100;

    for (let i = 0; i < groups.length; i += chunkSize) {
      const chunk = groups.slice(i, i + chunkSize);

      await Promise.all(
        chunk.map((group) =>
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          tx.group.upsert({
            where: { foreignId: group.id.toString() },
            update: {
              number: group.group,
              data: JSON.stringify(group),
              updatedAt: new Date(),
            },
            create: {
              number: group.group,
              foreignId: group.id.toString(),
              data: JSON.stringify(group),
            },
          }),
        ),
      );

      syncedCount += chunk.length;
    }

    return syncedCount;
  }

  // /**
  //  * Синхронизация предметов с БД
  //  */
  // async syncSubjects(subjects: ParsedSubjectDto[]): Promise<void> {
  //   try {
  //     this.logInfo(`Начинаем синхронизацию ${subjects.length} предметов`);

  //     for (const subject of subjects) {
  //       await this.db.subject.upsert({
  //         where: { name: subject.name },
  //         update: {
  //           updatedAt: new Date(),
  //         },
  //         create: {
  //           name: subject.name,
  //         },
  //       });
  //     }

  //     this.logInfo(
  //       `Синхронизация предметов завершена: ${subjects.length} записей`,
  //     );
  //   } catch (error) {
  //     this.logError('Ошибка при синхронизации предметов', error as Error);
  //     throw new BusinessException('Не удалось синхронизировать предметы');
  //   }
  // }

  // /**
  //  * Синхронизация связей между преподавателями, группами и предметами
  //  */
  // async syncRelations(
  //   teachers: ParsedTeacherDto[],
  //   groups: ParsedGroupDto[],
  //   subjects: ParsedSubjectDto[],
  // ): Promise<void> {
  //   try {
  //     this.logInfo('Начинаем синхронизацию связей');

  //     // Синхронизируем связи преподаватель-предмет
  //     await this.syncTeacherSubjects(teachers);

  //     // Синхронизируем связи группа-предмет
  //     await this.syncGroupSubjects(groups);

  //     this.logInfo('Синхронизация связей завершена');
  //   } catch (error) {
  //     this.logError('Ошибка при синхронизации связей', error as Error);
  //     throw new BusinessException('Не удалось синхронизировать связи');
  //   }
  // }

  //   /**
  //    * Синхронизация связей преподаватель-предмет
  //    */
  //   private async syncTeacherSubjects(
  //     teachers: ParsedTeacherDto[],
  //   ): Promise<void> {
  //     this.logInfo('Синхронизируем связи преподаватель-предмет');

  //     for (const teacherData of teachers) {
  //       // Получаем преподавателя из БД
  //       const teacher = await this.db.teacher.findUnique({
  //         where: { foreignId: teacherData.id },
  //       });

  //       if (!teacher) {
  //         this.logWarn(`Преподаватель не найден: ${teacherData.id}`);
  //         continue;
  //       }

  //       // Деактивируем все старые связи
  //       await this.db.teacherSubject.updateMany({
  //         where: { teacherId: teacher.id },
  //         data: { isActive: false },
  //       });

  //       // Создаем/активируем связи с предметами
  //       for (const subjectName of teacherData.subjects) {
  //         const subject = await this.db.subject.findUnique({
  //           where: { name: subjectName },
  //         });

  //         if (!subject) {
  //           this.logWarn(`Предмет не найден: ${subjectName}`);
  //           continue;
  //         }

  //         await this.db.teacherSubject.upsert({
  //           where: {
  //             teacherId_subjectId: {
  //               teacherId: teacher.id,
  //               subjectId: subject.id,
  //             },
  //           },
  //           update: {
  //             isActive: true,
  //             updatedAt: new Date(),
  //           },
  //           create: {
  //             teacherId: teacher.id,
  //             subjectId: subject.id,
  //             isActive: true,
  //           },
  //         });
  //       }
  //     }

  //     this.logInfo('Связи преподаватель-предмет синхронизированы');
  //   }

  //   /**
  //    * Синхронизация связей группа-предмет
  //    */
  //   private async syncGroupSubjects(groups: ParsedGroupDto[]): Promise<void> {
  //     this.logInfo('Синхронизируем связи группа-предмет');

  //     for (const groupData of groups) {
  //       // Получаем группу из БД
  //       const group = await this.db.group.findUnique({
  //         where: { foreignId: groupData.foreignId },
  //       });

  //       if (!group) {
  //         this.logWarn(`Группа не найдена: ${groupData.foreignId}`);
  //         continue;
  //       }

  //       // Удаляем все старые связи группы с предметами
  //       await this.db.groupSubject.deleteMany({
  //         where: { groupId: group.id },
  //       });

  //       // Создаем новые связи с предметами
  //       for (const subjectName of groupData.subjects) {
  //         const subject = await this.db.subject.findUnique({
  //           where: { name: subjectName },
  //         });

  //         if (!subject) {
  //           this.logWarn(`Предмет не найден: ${subjectName}`);
  //           continue;
  //         }

  //         await this.db.groupSubject.create({
  //           data: {
  //             groupId: group.id,
  //             subjectId: subject.id,
  //           },
  //         });
  //       }
  //     }

  //     this.logInfo('Связи группа-предмет синхронизированы');
  //   }

  //   /**
  //    * Получить статистику синхронизации
  //    */
  //   async getSyncStats() {
  //     try {
  //       const [
  //         teachersCount,
  //         groupsCount,
  //         subjectsCount,
  //         teacherSubjectsCount,
  //         groupSubjectsCount,
  //       ] = await Promise.all([
  //         this.db.teacher.count(),
  //         this.db.group.count(),
  //         this.db.subject.count({ where: { isActive: true } }),
  //         this.db.teacherSubject.count({ where: { isActive: true } }),
  //         this.db.groupSubject.count(),
  //       ]);

  //       return {
  //         teachers: teachersCount,
  //         groups: groupsCount,
  //         subjects: subjectsCount,
  //         teacherSubjectRelations: teacherSubjectsCount,
  //         groupSubjectRelations: groupSubjectsCount,
  //         lastUpdated: new Date(),
  //       };
  //     } catch (error) {
  //       this.logError('Ошибка при получении статистики', error as Error);
  //       throw new BusinessException(
  //         'Не удалось получить статистику синхронизации',
  //       );
  //     }
  //   }

  //   /**
  //    * Получить статус последней синхронизации
  //    */
  //   async getLastSyncStatus() {
  //     try {
  //       // Получаем последние обновленные записи
  //       const [lastTeacher, lastGroup, lastSubject] = await Promise.all([
  //         this.db.teacher.findFirst({
  //           orderBy: { updatedAt: 'desc' },
  //           select: { updatedAt: true },
  //         }),
  //         this.db.group.findFirst({
  //           orderBy: { updatedAt: 'desc' },
  //           select: { updatedAt: true },
  //         }),
  //         this.db.subject.findFirst({
  //           orderBy: { updatedAt: 'desc' },
  //           select: { updatedAt: true },
  //         }),
  //       ]);

  //       const lastSyncTime = [
  //         lastTeacher?.updatedAt,
  //         lastGroup?.updatedAt,
  //         lastSubject?.updatedAt,
  //       ]
  //         .filter(Boolean)
  //         .sort((a, b) => b.getTime() - a.getTime())[0];

  //       return {
  //         lastSyncTime,
  //         status: lastSyncTime ? 'completed' : 'never_synced',
  //       };
  //     } catch (error) {
  //       this.logError(
  //         'Ошибка при получении статуса синхронизации',
  //         error as Error,
  //       );
  //       throw new BusinessException('Не удалось получить статус синхронизации');
  //     }
  //   }
}

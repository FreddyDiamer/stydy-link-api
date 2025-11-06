import { PrismaClient } from '@prisma/client';
import { TeacherDto, GroupDto } from '../../dto/parsed-data.dto';
import { retry, normalizeError } from './logger';

export class WorkerSyncService {
  constructor(private readonly db: PrismaClient) {}

  async syncTeachers(teachers: TeacherDto[]): Promise<number> {
    if (teachers.length === 0) return 0;

    try {
      return await retry(
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
      const err = normalizeError(error);
      throw err;
    }
  }

  async syncGroups(groups: GroupDto[]): Promise<number> {
    if (groups.length === 0) return 0;

    try {
      return await retry(
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
      const err = normalizeError(error);
      throw err;
    }
  }

  private async syncTeachersInTx(
    tx: any,
    teachers: TeacherDto[],
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

  private async syncGroupsInTx(tx: any, groups: GroupDto[]): Promise<number> {
    let syncedCount = 0;
    const chunkSize = 100;

    for (let i = 0; i < groups.length; i += chunkSize) {
      const chunk = groups.slice(i, i + chunkSize);

      await Promise.all(
        chunk.map((group) =>
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
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

  async getAllGroups() {
    return await this.db.group.findMany();
  }

  async getAllTeachers() {
    return await this.db.teacher.findMany();
  }

  async syncSubjectsBatch(subjects: string[]): Promise<void> {
    if (subjects.length === 0) return;

    try {
      await retry(
        async () => {
          await this.db.$transaction(
            async (tx) => {
              const chunkSize = 100;
              for (let i = 0; i < subjects.length; i += chunkSize) {
                const chunk = subjects.slice(i, i + chunkSize);

                await Promise.all(
                  chunk.map((subject) =>
                    tx.subject.upsert({
                      where: { name: subject },
                      update: {
                        updatedAt: new Date(),
                      },
                      create: {
                        name: subject,
                      },
                    }),
                  ),
                );
              }
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
      const err = normalizeError(error);
      throw err;
    }
  }

  async syncRelationsBatch(
    relationsMap: Map<string, { teacherId: string; subjectName: string }[]>,
  ): Promise<void> {
    try {
      await retry(
        async () => {
          await this.db.$transaction(
            async (tx) => {
              const groupIds = Array.from(relationsMap.keys());

              const uniqueSubjectNames = new Set<string>();
              const uniqueTeacherIds = new Set<string>();

              for (const relations of relationsMap.values()) {
                for (const relation of relations) {
                  uniqueSubjectNames.add(relation.subjectName);
                  uniqueTeacherIds.add(relation.teacherId);
                }
              }

              const subjects: { name: string; id: string }[] =
                await tx.subject.findMany({
                  where: { name: { in: Array.from(uniqueSubjectNames) } },
                });

              const subjectMap = new Map(
                subjects.map((s: { name: string; id: string }) => [
                  s.name,
                  s.id,
                ]),
              );

              await Promise.all([
                tx.groupSubject.updateMany({
                  where: { groupId: { in: groupIds } },
                  data: {},
                }),

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                (tx as any).groupSubjectTeacher.updateMany({
                  where: { groupId: { in: groupIds } },
                  data: { isActive: false },
                }),
              ]);

              await tx.teacherSubject.updateMany({
                where: { teacherId: { in: Array.from(uniqueTeacherIds) } },
                data: { isActive: false },
              });

              const chunkSize = 50;
              const groupIdsArray = Array.from(relationsMap.entries());

              for (let i = 0; i < groupIdsArray.length; i += chunkSize) {
                const chunk = groupIdsArray.slice(i, i + chunkSize);

                await Promise.all(
                  chunk.map(async ([groupId, relations]) => {
                    const operations: Promise<any>[] = [];

                    for (const relation of relations) {
                      const subjectId: string | undefined = subjectMap.get(
                        relation.subjectName,
                      );
                      if (!subjectId) {
                        continue;
                      }

                      operations.push(
                        tx.teacherSubject.upsert({
                          where: {
                            teacherId_subjectId: {
                              teacherId: relation.teacherId,
                              subjectId,
                            },
                          },
                          update: {
                            isActive: true,
                            updatedAt: new Date(),
                          },
                          create: {
                            teacherId: relation.teacherId,
                            subjectId: subjectId,
                            isActive: true,
                          },
                        }),
                      );

                      operations.push(
                        tx.groupSubject.upsert({
                          where: {
                            groupId_subjectId: {
                              groupId: groupId,
                              subjectId: subjectId,
                            },
                          },
                          update: {
                            updatedAt: new Date(),
                          },
                          create: {
                            groupId: groupId,
                            subjectId: subjectId,
                          },
                        }),
                      );

                      operations.push(
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
                        (tx as any).groupSubjectTeacher.upsert({
                          where: {
                            groupId_subjectId_teacherId: {
                              groupId: groupId,
                              subjectId: subjectId,
                              teacherId: relation.teacherId,
                            },
                          },
                          update: {
                            isActive: true,
                            updatedAt: new Date(),
                          },
                          create: {
                            groupId: groupId,
                            subjectId: subjectId,
                            teacherId: relation.teacherId,
                            isActive: true,
                          },
                        }),
                      );
                    }

                    await Promise.all(operations);
                  }),
                );
              }
            },
            {
              maxWait: 10000,
              timeout: 60000,
            },
          );
        },
        { maxAttempts: 2, delay: 1000 },
      );
    } catch (error) {
      const err = normalizeError(error);
      throw err;
    }
  }
}

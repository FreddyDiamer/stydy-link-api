import { Injectable } from '@nestjs/common';
import { TeacherSubject, Prisma } from '@prisma/client';
import { DatabaseService } from '../../../database/database.service';
import {
  CreateTeacherSubjectDto,
  UpdateTeacherSubjectDto,
  TeacherSubjectFilterDto,
} from './dto/teacher-subject.dto';
import {
  BaseService,
  BusinessException,
  NotFoundException,
  PaginatedResult,
  PaginationDto,
} from '@common';
import { compareRu } from '../education-sort';

/** Предмет, который ведёт преподаватель: id связи и сам предмет */
export interface TeacherSubjectOfTeacher {
  id: string;
  subject: { id: string; name: string };
}

@Injectable()
export class TeacherSubjectsService extends BaseService {
  constructor(private readonly db: DatabaseService) {
    super();
  }

  async create(
    createTeacherSubjectDto: CreateTeacherSubjectDto,
  ): Promise<TeacherSubject> {
    try {
      // Проверяем существование преподавателя и предмета
      const [teacher, subject] = await Promise.all([
        this.db.teacher.findUnique({
          where: { id: createTeacherSubjectDto.teacherId },
        }),
        this.db.subject.findUnique({
          where: { id: createTeacherSubjectDto.subjectId },
        }),
      ]);

      if (!teacher) {
        throw new NotFoundException(
          'Teacher',
          createTeacherSubjectDto.teacherId,
        );
      }

      if (!subject) {
        throw new NotFoundException(
          'Subject',
          createTeacherSubjectDto.subjectId,
        );
      }

      // Проверяем, не существует ли уже такая связь
      const existingRelation = await this.db.teacherSubject.findFirst({
        where: {
          teacherId: createTeacherSubjectDto.teacherId,
          subjectId: createTeacherSubjectDto.subjectId,
        },
      });

      if (existingRelation) {
        throw new BusinessException(
          `Связь между преподавателем "${teacher.fullName}" и предметом "${subject.name}" уже существует`,
        );
      }

      const teacherSubject = await this.db.teacherSubject.create({
        data: createTeacherSubjectDto,
        include: {
          teacher: {
            select: {
              id: true,
              fullName: true,
            },
          },
          subject: {
            select: {
              id: true,
              name: true,
              isActive: true,
            },
          },
        },
      });

      this.logInfo('Создана связь преподавателя с предметом', {
        teacherSubjectId: teacherSubject.id,
        teacherName: teacher.fullName,
        subjectName: subject.name,
      });

      return teacherSubject;
    } catch (error) {
      if (
        error instanceof BusinessException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logError(
        'Ошибка создания связи преподавателя с предметом',
        error as Error,
        createTeacherSubjectDto,
      );
      throw error;
    }
  }

  async findAll(
    paginationDto: PaginationDto,
    filterDto: TeacherSubjectFilterDto,
  ): Promise<PaginatedResult<TeacherSubject>> {
    try {
      const where: Prisma.TeacherSubjectWhereInput = {};

      // Фильтры
      if (filterDto.teacherId) {
        where.teacherId = filterDto.teacherId;
      }

      if (filterDto.subjectId) {
        where.subjectId = filterDto.subjectId;
      }

      // Поиск по имени преподавателя
      if (filterDto.teacherName?.trim()) {
        where.teacher = {
          fullName: {
            contains: filterDto.teacherName.trim(),
            mode: 'insensitive',
          },
        };
      }

      // Поиск по названию предмета
      if (filterDto.subjectName?.trim()) {
        where.subject = {
          name: {
            contains: filterDto.subjectName.trim(),
            mode: 'insensitive',
          },
        };
      }

      const [items, total] = await Promise.all([
        this.db.teacherSubject.findMany({
          where,
          skip: paginationDto.skip,
          take: paginationDto.limit,
          orderBy: [
            { teacher: { fullName: 'asc' } },
            { subject: { name: 'asc' } },
          ],
          include: {
            teacher: {
              select: {
                id: true,
                fullName: true,
              },
            },
            subject: {
              select: {
                id: true,
                name: true,
                isActive: true,
              },
            },
          },
        }),
        this.db.teacherSubject.count({ where }),
      ]);

      return {
        items,
        total,
        page: paginationDto.page,
        limit: paginationDto.limit,
        totalPages: Math.ceil(total / paginationDto.limit),
      };
    } catch (error) {
      this.logError(
        'Ошибка получения списка связей преподавателей с предметами',
        error as Error,
        {
          pagination: paginationDto,
          filter: filterDto,
        },
      );
      throw error;
    }
  }

  async findOne(id: string): Promise<TeacherSubject> {
    const teacherSubject = await this.db.teacherSubject.findUnique({
      where: { id },
      include: {
        teacher: {
          select: {
            id: true,
            fullName: true,
            createdAt: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    });

    if (!teacherSubject) {
      throw new NotFoundException('TeacherSubject', id);
    }

    return teacherSubject;
  }

  async findByTeacherAndSubject(
    teacherId: string,
    subjectId: string,
  ): Promise<TeacherSubject | null> {
    return this.db.teacherSubject.findFirst({
      where: {
        teacherId,
        subjectId,
      },
      include: {
        teacher: {
          select: {
            id: true,
            fullName: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
      },
    });
  }

  /** Все активные предметы преподавателя, без пагинации: фронту нужен полный список */
  async findActiveByTeacher(
    teacherId: string,
  ): Promise<TeacherSubjectOfTeacher[]> {
    const links = await this.db.teacherSubject.findMany({
      where: {
        teacherId,
        isActive: true,
        subject: { isActive: true },
      },
      select: {
        id: true,
        subject: { select: { id: true, name: true } },
      },
    });
    return links.sort((a, b) => compareRu(a.subject.name, b.subject.name));
  }

  async findActiveBySubject(subjectId: string): Promise<TeacherSubject[]> {
    return this.db.teacherSubject.findMany({
      where: {
        subjectId,
        isActive: true,
      },
      include: {
        teacher: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: { teacher: { fullName: 'asc' } },
    });
  }

  async update(
    id: string,
    updateTeacherSubjectDto: UpdateTeacherSubjectDto,
  ): Promise<TeacherSubject> {
    try {
      // Проверяем существование связи
      await this.findOne(id);

      // Если изменяется преподаватель или предмет, проверяем уникальность
      if (
        updateTeacherSubjectDto.teacherId ||
        updateTeacherSubjectDto.subjectId
      ) {
        const currentRelation = await this.findOne(id);
        const newTeacherId =
          updateTeacherSubjectDto.teacherId || currentRelation.teacherId;
        const newSubjectId =
          updateTeacherSubjectDto.subjectId || currentRelation.subjectId;

        const existingRelation = await this.db.teacherSubject.findFirst({
          where: {
            id: { not: id },
            teacherId: newTeacherId,
            subjectId: newSubjectId,
          },
        });

        if (existingRelation) {
          throw new BusinessException(
            'Связь с такими преподавателем и предметом уже существует',
          );
        }

        // Проверяем существование новых преподавателя/предмета
        if (updateTeacherSubjectDto.teacherId) {
          const teacher = await this.db.teacher.findUnique({
            where: { id: updateTeacherSubjectDto.teacherId },
          });
          if (!teacher) {
            throw new NotFoundException(
              'Teacher',
              updateTeacherSubjectDto.teacherId,
            );
          }
        }

        if (updateTeacherSubjectDto.subjectId) {
          const subject = await this.db.subject.findUnique({
            where: { id: updateTeacherSubjectDto.subjectId },
          });
          if (!subject) {
            throw new NotFoundException(
              'Subject',
              updateTeacherSubjectDto.subjectId,
            );
          }
        }
      }

      const updatedTeacherSubject = await this.db.teacherSubject.update({
        where: { id },
        data: {
          ...updateTeacherSubjectDto,
          updatedAt: new Date(),
        },
        include: {
          teacher: {
            select: {
              id: true,
              fullName: true,
            },
          },
          subject: {
            select: {
              id: true,
              name: true,
              isActive: true,
            },
          },
        },
      });

      this.logInfo('Связь преподавателя с предметом обновлена', {
        teacherSubjectId: id,
        ...updateTeacherSubjectDto,
      });

      return updatedTeacherSubject;
    } catch (error) {
      if (
        error instanceof BusinessException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logError(
        'Ошибка обновления связи преподавателя с предметом',
        error as Error,
        {
          id,
          ...updateTeacherSubjectDto,
        },
      );
      throw error;
    }
  }

  async activate(id: string): Promise<TeacherSubject> {
    return this.update(id, { isActive: true });
  }

  async deactivate(id: string): Promise<TeacherSubject> {
    return this.update(id, { isActive: false });
  }

  async remove(id: string): Promise<void> {
    try {
      const teacherSubject = await this.findOne(id);

      // Проверяем, используется ли связь в услугах, заявках или сделках
      const [servicesCount, requestsCount, dealsCount] = await Promise.all([
        this.db.service.count({
          where: {
            teacherId: teacherSubject.teacherId,
            subjectId: teacherSubject.subjectId,
          },
        }),
        this.db.request.count({
          where: {
            teacherId: teacherSubject.teacherId,
            subjectId: teacherSubject.subjectId,
          },
        }),
        this.db.deal.count({
          where: {
            teacherId: teacherSubject.teacherId,
            subjectId: teacherSubject.subjectId,
          },
        }),
      ]);

      const totalUsage = servicesCount + requestsCount + dealsCount;

      if (totalUsage > 0) {
        throw new BusinessException(
          'Нельзя удалить связь преподавателя с предметом, которая используется в системе. ' +
            'Деактивируйте ее вместо удаления.',
        );
      }

      await this.db.teacherSubject.delete({
        where: { id },
      });

      this.logInfo('Связь преподавателя с предметом удалена', {
        teacherSubjectId: id,
        teacherId: teacherSubject.teacherId,
        subjectId: teacherSubject.subjectId,
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BusinessException
      ) {
        throw error;
      }
      this.logError(
        'Ошибка удаления связи преподавателя с предметом',
        error as Error,
        { id },
      );
      throw error;
    }
  }

  async bulkCreate(
    relationships: CreateTeacherSubjectDto[],
  ): Promise<TeacherSubject[]> {
    try {
      const results: TeacherSubject[] = [];

      for (const relationship of relationships) {
        const existing = await this.findByTeacherAndSubject(
          relationship.teacherId,
          relationship.subjectId,
        );

        if (!existing) {
          const created = await this.create(relationship);
          results.push(created);
        }
      }

      this.logInfo(
        'Массовое создание связей преподавателей с предметами завершено',
        {
          created: results.length,
          total: relationships.length,
        },
      );

      return results;
    } catch (error) {
      this.logError('Ошибка массового создания связей', error as Error, {
        relationships,
      });
      throw error;
    }
  }

  async getTeacherSubjectStats(teacherId: string, subjectId: string) {
    const teacherSubject = await this.findByTeacherAndSubject(
      teacherId,
      subjectId,
    );

    if (!teacherSubject) {
      throw new NotFoundException('TeacherSubject relation not found');
    }

    const [activeServicesCount, totalRequestsCount, completedDealsCount] =
      await Promise.all([
        // Активные услуги по данной связи
        this.db.service.count({
          where: { teacherId, subjectId, status: 'ACTIVE' },
        }),
        // Всего заявок по данной связи
        this.db.request.count({
          where: { teacherId, subjectId },
        }),
        // Завершенные сделки по данной связи
        this.db.deal.count({
          where: { teacherId, subjectId, status: 'COMPLETED' },
        }),
      ]);

    return {
      teacherSubject: {
        id: teacherSubject.id,
        isActive: teacherSubject.isActive,
        teacherId: teacherSubject.teacherId,
        subjectId: teacherSubject.subjectId,
        createdAt: teacherSubject.createdAt,
      },
      stats: {
        activeServices: activeServicesCount,
        totalRequests: totalRequestsCount,
        completedDeals: completedDealsCount,
        popularity: activeServicesCount + totalRequestsCount,
      },
    };
  }
}

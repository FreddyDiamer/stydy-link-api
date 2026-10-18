import { Injectable } from '@nestjs/common';
import { Teacher, Prisma } from '@prisma/client';
import { DatabaseService } from '../../../database/database.service';
import {
  CreateTeacherDto,
  UpdateTeacherDto,
  TeacherFilterDto,
} from './dto/teacher.dto';
import {
  BaseService,
  BusinessException,
  NotFoundException,
  PaginationDto,
} from '@common';
import { searchByName, sortByName } from '../education-sort';

/** Элемент списка преподавателей: вложенные предметы и счётчики — только в /:id */
export type TeacherListItem = Pick<Teacher, 'id' | 'fullName'>;

const TEACHER_LIST_SELECT = {
  id: true,
  fullName: true,
} satisfies Prisma.TeacherSelect;

@Injectable()
export class TeachersService extends BaseService {
  constructor(private readonly db: DatabaseService) {
    super();
  }

  async create(createTeacherDto: CreateTeacherDto): Promise<Teacher> {
    try {
      const teacher = await this.db.teacher.create({
        data: {
          fullName: createTeacherDto.fullName.trim(),
          foreignId: createTeacherDto.foreignId,
        },
      });

      this.logInfo('Создан новый преподаватель', {
        teacherId: teacher.id,
        fullName: teacher.fullName,
      });

      return teacher;
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      this.logError(
        'Ошибка создания преподавателя',
        error as Error,
        createTeacherDto,
      );
      throw new BusinessException('Не удалось создать преподавателя');
    }
  }

  async findAll(
    paginationDto: PaginationDto,
    filterDto: TeacherFilterDto,
  ): Promise<TeacherListItem[]> {
    try {
      // TODO: Поиск по внешнему ID после обновления Prisma client

      // Поиск, ранжирование и страница — в приложении (см. education-sort):
      // «начинается с запроса» выше «содержит», и не зависит от локали базы
      const teachers = await this.db.teacher.findMany({
        select: TEACHER_LIST_SELECT,
      });

      return searchByName(teachers, (t) => t.fullName, filterDto.search).slice(
        paginationDto.skip,
        paginationDto.skip + paginationDto.limit,
      );
    } catch (error) {
      this.logError('Ошибка получения списка преподавателей', error as Error, {
        pagination: paginationDto,
        filter: filterDto,
      });
      throw new BusinessException('Не удалось получить список преподавателей');
    }
  }

  async findOne(id: string): Promise<Teacher> {
    const teacher = await this.db.teacher.findUnique({
      where: { id },
      include: {
        teacherSubjects: {
          where: { isActive: true },
          include: {
            subject: {
              select: {
                id: true,
                name: true,
                isActive: true,
                createdAt: true,
              },
            },
          },
          orderBy: { subject: { name: 'asc' } },
        },
        _count: {
          select: {
            services: { where: { status: 'ACTIVE' } },
            requests: true,
            deals: true,
            teacherSubjects: { where: { isActive: true } },
          },
        },
      },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher', id);
    }

    return teacher;
  }

  async findByForeignId(foreignId: string): Promise<Teacher | null> {
    return this.db.teacher.findUnique({ where: { foreignId } });
  }

  async findActiveTeachers(): Promise<TeacherListItem[]> {
    const teachers = await this.db.teacher.findMany({
      where: {
        teacherSubjects: {
          some: { isActive: true },
        },
      },
      select: TEACHER_LIST_SELECT,
    });
    return sortByName(teachers, (t) => t.fullName);
  }

  async update(
    id: string,
    updateTeacherDto: UpdateTeacherDto,
  ): Promise<Teacher> {
    try {
      // Проверяем существование преподавателя
      await this.findOne(id);

      const updatedTeacher = await this.db.teacher.update({
        where: { id },
        data: {
          ...(updateTeacherDto.fullName && {
            fullName: updateTeacherDto.fullName.trim(),
          }),
          // TODO: добавить обновление foreignId после обновления Prisma client
          updatedAt: new Date(),
        },
      });

      this.logInfo('Преподаватель обновлен', {
        teacherId: id,
        ...updateTeacherDto,
      });
      return updatedTeacher;
    } catch (error) {
      if (
        error instanceof BusinessException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logError('Ошибка обновления преподавателя', error as Error, {
        id,
        ...updateTeacherDto,
      });
      throw new BusinessException('Не удалось обновить преподавателя');
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.findOne(id);

      // Проверяем, используется ли преподаватель в системе
      const usage = await this.db.teacher.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              services: true,
              requests: true,
              deals: true,
              teacherSubjects: true,
            },
          },
        },
      });

      if (!usage) {
        throw new NotFoundException('Teacher', id);
      }

      const totalUsage =
        usage._count.services +
        usage._count.requests +
        usage._count.deals +
        usage._count.teacherSubjects;

      if (totalUsage > 0) {
        throw new BusinessException(
          'Нельзя удалить преподавателя, который используется в системе. ' +
            'Деактивируйте связи с предметами вместо удаления.',
        );
      }

      await this.db.teacher.delete({
        where: { id },
      });

      this.logInfo('Преподаватель удален', { teacherId: id });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BusinessException
      ) {
        throw error;
      }
      this.logError('Ошибка удаления преподавателя', error as Error, { id });
      throw new BusinessException('Не удалось удалить преподавателя');
    }
  }

  async getTeacherStats(teacherId: string) {
    const teacher = await this.findOne(teacherId);

    const [
      activeServicesCount,
      totalRequestsCount,
      completedDealsCount,
      activeSubjectsCount,
    ] = await Promise.all([
      // Активные услуги преподавателя
      this.db.service.count({
        where: { teacherId, status: 'ACTIVE' },
      }),
      // Всего заявок к преподавателю
      this.db.request.count({
        where: { teacherId },
      }),
      // Завершенные сделки преподавателя
      this.db.deal.count({
        where: { teacherId, status: 'COMPLETED' },
      }),
      // Активные предметы преподавателя
      this.db.teacherSubject.count({
        where: { teacherId, isActive: true },
      }),
    ]);

    return {
      teacher: {
        id: teacher.id,
        fullName: teacher.fullName,
        createdAt: teacher.createdAt,
        updatedAt: teacher.updatedAt,
      },
      stats: {
        activeServices: activeServicesCount,
        totalRequests: totalRequestsCount,
        completedDeals: completedDealsCount,
        activeSubjects: activeSubjectsCount,
        popularity: activeServicesCount + totalRequestsCount,
      },
    };
  }

  /** Все преподаватели предмета, без пагинации: фронту нужен полный список */
  async getTeachersBySubject(subjectId: string): Promise<TeacherListItem[]> {
    const teachers = await this.db.teacher.findMany({
      where: {
        teacherSubjects: {
          some: {
            subjectId,
            isActive: true,
          },
        },
      },
      select: TEACHER_LIST_SELECT,
    });
    return sortByName(teachers, (t) => t.fullName);
  }
}

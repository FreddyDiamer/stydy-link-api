import { Injectable } from '@nestjs/common';
import { Subject, Prisma } from '@prisma/client';
import { DatabaseService } from '../../../database/database.service';
import {
  CreateSubjectDto,
  UpdateSubjectDto,
  SubjectFilterDto,
} from './dto/subject.dto';
import {
  BaseService,
  BusinessException,
  NotFoundException,
  PaginationDto,
} from '@common';
import { searchByName, sortByName } from '../education-sort';

/** Элемент списка предметов: вложенные преподаватели и счётчики — только в /:id */
export type SubjectListItem = Pick<Subject, 'id' | 'name' | 'isActive'>;

const SUBJECT_LIST_SELECT = {
  id: true,
  name: true,
  isActive: true,
} satisfies Prisma.SubjectSelect;

@Injectable()
export class SubjectsService extends BaseService {
  constructor(private readonly db: DatabaseService) {
    super();
  }

  async create(createSubjectDto: CreateSubjectDto): Promise<Subject> {
    try {
      // Проверяем уникальность названия предмета
      const existingSubject = await this.db.subject.findFirst({
        where: {
          name: {
            equals: createSubjectDto.name.trim(),
            mode: 'insensitive',
          },
        },
      });

      if (existingSubject) {
        throw new BusinessException(
          `Предмет с названием "${createSubjectDto.name}" уже существует`,
        );
      }

      const subject = await this.db.subject.create({
        data: {
          ...createSubjectDto,
          name: createSubjectDto.name.trim(),
        },
      });

      this.logInfo('Создан новый предмет', {
        subjectId: subject.id,
        name: subject.name,
      });

      return subject;
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      this.logError(
        'Ошибка создания предмета',
        error as Error,
        createSubjectDto,
      );
      throw error;
    }
  }

  async findAll(
    paginationDto: PaginationDto,
    filterDto: SubjectFilterDto,
  ): Promise<SubjectListItem[]> {
    try {
      // по умолчанию — только активные; явный isActive=false отдаёт неактивные
      const where: Prisma.SubjectWhereInput = {
        isActive: filterDto.isActive ?? true,
      };

      // Поиск, ранжирование и страница — в приложении (см. education-sort):
      // «начинается с запроса» выше «содержит», и не зависит от локали базы
      const subjects = await this.db.subject.findMany({
        where,
        select: SUBJECT_LIST_SELECT,
      });

      return searchByName(subjects, (s) => s.name, filterDto.search).slice(
        paginationDto.skip,
        paginationDto.skip + paginationDto.limit,
      );
    } catch (error) {
      this.logError('Ошибка получения списка предметов', error as Error, {
        pagination: paginationDto,
        filter: filterDto,
      });
      throw error;
    }
  }

  async findOne(id: string): Promise<Subject> {
    const subject = await this.db.subject.findUnique({
      where: { id },
      include: {
        teacherSubjects: {
          where: { isActive: true },
          include: {
            teacher: {
              select: {
                id: true,
                fullName: true,
                createdAt: true,
              },
            },
          },
          orderBy: { teacher: { fullName: 'asc' } },
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

    if (!subject) {
      throw new NotFoundException('Subject', id);
    }

    return subject;
  }

  async findByName(name: string): Promise<Subject | null> {
    return this.db.subject.findFirst({
      where: {
        name: {
          equals: name.trim(),
          mode: 'insensitive',
        },
      },
    });
  }

  async findActive(): Promise<SubjectListItem[]> {
    const subjects = await this.db.subject.findMany({
      where: { isActive: true },
      select: SUBJECT_LIST_SELECT,
    });
    return sortByName(subjects, (s) => s.name);
  }

  async update(
    id: string,
    updateSubjectDto: UpdateSubjectDto,
  ): Promise<Subject> {
    try {
      // Проверяем существование предмета
      await this.findOne(id);

      // Проверяем уникальность названия при обновлении
      if (updateSubjectDto.name?.trim()) {
        const existingSubject = await this.db.subject.findFirst({
          where: {
            id: { not: id },
            name: {
              equals: updateSubjectDto.name.trim(),
              mode: 'insensitive',
            },
          },
        });

        if (existingSubject) {
          throw new BusinessException(
            `Предмет с названием "${updateSubjectDto.name}" уже существует`,
          );
        }
      }

      const updatedSubject = await this.db.subject.update({
        where: { id },
        data: {
          ...updateSubjectDto,
          ...(updateSubjectDto.name && { name: updateSubjectDto.name.trim() }),
          updatedAt: new Date(),
        },
      });

      this.logInfo('Предмет обновлен', { subjectId: id, ...updateSubjectDto });
      return updatedSubject;
    } catch (error) {
      if (
        error instanceof BusinessException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logError('Ошибка обновления предмета', error as Error, {
        id,
        ...updateSubjectDto,
      });
      throw error;
    }
  }

  async activate(id: string): Promise<Subject> {
    return this.update(id, { isActive: true });
  }

  async deactivate(id: string): Promise<Subject> {
    return this.update(id, { isActive: false });
  }

  async remove(id: string): Promise<void> {
    try {
      await this.findOne(id);

      // Проверяем, используется ли предмет в системе
      const usage = await this.db.subject.findUnique({
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
        throw new NotFoundException('Subject', id);
      }

      const totalUsage =
        usage._count.services +
        usage._count.requests +
        usage._count.deals +
        usage._count.teacherSubjects;

      if (totalUsage > 0) {
        throw new BusinessException(
          'Нельзя удалить предмет, который используется в системе. ' +
            'Деактивируйте его вместо удаления.',
        );
      }

      await this.db.subject.delete({
        where: { id },
      });

      this.logInfo('Предмет удален', { subjectId: id });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BusinessException
      ) {
        throw error;
      }
      this.logError('Ошибка удаления предмета', error as Error, { id });
      throw error;
    }
  }

  async getSubjectStats(subjectId: string) {
    const subject = await this.findOne(subjectId);

    const [
      activeServicesCount,
      totalRequestsCount,
      completedDealsCount,
      activeTeachersCount,
    ] = await Promise.all([
      // Активные услуги по предмету
      this.db.service.count({
        where: { subjectId, status: 'ACTIVE' },
      }),
      // Всего заявок по предмету
      this.db.request.count({
        where: { subjectId },
      }),
      // Завершенные сделки по предмету
      this.db.deal.count({
        where: { subjectId, status: 'COMPLETED' },
      }),
      // Активные преподаватели по предмету
      this.db.teacherSubject.count({
        where: { subjectId, isActive: true },
      }),
    ]);

    return {
      subject: {
        id: subject.id,
        name: subject.name,
        isActive: subject.isActive,
        createdAt: subject.createdAt,
        updatedAt: subject.updatedAt,
      },
      stats: {
        activeServices: activeServicesCount,
        totalRequests: totalRequestsCount,
        completedDeals: completedDealsCount,
        activeTeachers: activeTeachersCount,
        popularity: activeServicesCount + totalRequestsCount,
      },
    };
  }
}

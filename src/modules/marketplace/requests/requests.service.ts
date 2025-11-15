import { Injectable } from '@nestjs/common';
import { Request, Prisma } from '@prisma/client';
import { DatabaseService } from '../../../database/database.service';
import {
  CreateRequestDto,
  UpdateRequestDto,
  RequestFilterDto,
} from './dto/request.dto';
import {
  BaseService,
  BusinessException,
  NotFoundException,
  PaginatedResult,
  PaginationDto,
} from '@common';

@Injectable()
export class RequestsService extends BaseService {
  constructor(private readonly db: DatabaseService) {
    super();
  }

  async create(createRequestDto: CreateRequestDto): Promise<Request> {
    try {
      // Проверяем существование студента
      const student = await this.db.user.findUnique({
        where: { id: createRequestDto.studentId },
      });

      if (!student) {
        throw new NotFoundException('User', createRequestDto.studentId);
      }

      // Проверяем существование предмета и преподавателя
      const [subject, teacher] = await Promise.all([
        this.db.subject.findUnique({
          where: { id: createRequestDto.subjectId },
        }),
        this.db.teacher.findUnique({
          where: { id: createRequestDto.teacherId },
        }),
      ]);

      if (!subject) {
        throw new NotFoundException('Subject', createRequestDto.subjectId);
      }

      if (!teacher) {
        throw new NotFoundException('Teacher', createRequestDto.teacherId);
      }

      // TODO вернуть проверку
      // Проверяем, что существует активная связь между преподавателем и предметом
      // const teacherSubject = await this.db.teacherSubject.findFirst({
      //   where: {
      //     teacherId: createRequestDto.teacherId,
      //     subjectId: createRequestDto.subjectId,
      //     isActive: true,
      //   },
      // });

      // if (!teacherSubject) {
      //   throw new BusinessException(
      //     `Преподаватель "${teacher.fullName}" не ведет предмет "${subject.name}" или связь неактивна`,
      //   );
      // }

      // Создаем заявку
      const request = await this.db.request.create({
        data: {
          studentId: createRequestDto.studentId,
          subjectId: createRequestDto.subjectId,
          teacherId: createRequestDto.teacherId,
          description: createRequestDto.description,
          budget: createRequestDto.budget,
          deadline: createRequestDto.deadline,
        },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              telegramUsername: true,
            },
          },
          subject: {
            select: {
              id: true,
              name: true,
              isActive: true,
            },
          },
          teacher: {
            select: {
              id: true,
              fullName: true,
            },
          },
          responses: {
            select: {
              id: true,
              tutor: {
                select: {
                  id: true,
                  name: true,
                  telegramUsername: true,
                },
              },
              status: true,
              createdAt: true,
            },
          },
        },
      });

      this.logInfo('Создана новая заявка', {
        requestId: request.id,
        studentName: student.name,
        subjectName: subject.name,
        teacherName: teacher.fullName,
        budget: request.budget,
      });

      return request;
    } catch (error) {
      if (
        error instanceof BusinessException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logError('Ошибка создания заявки', error as Error, createRequestDto);
      throw new BusinessException('Не удалось создать заявку');
    }
  }

  async findAll(filterDto: RequestFilterDto): Promise<Request[]> {
    try {
      const where: Prisma.RequestWhereInput = {};

      // Фильтры
      if (filterDto.studentId) {
        where.studentId = filterDto.studentId;
      }

      if (filterDto.subjectId) {
        where.subjectId = filterDto.subjectId;
      }

      if (filterDto.teacherId) {
        where.teacherId = filterDto.teacherId;
      }

      // Фильтр по бюджету
      if (
        filterDto.minBudget !== undefined ||
        filterDto.maxBudget !== undefined
      ) {
        where.budget = {};
        if (filterDto.minBudget !== undefined) {
          where.budget.gte = filterDto.minBudget;
        }
        if (filterDto.maxBudget !== undefined) {
          where.budget.lte = filterDto.maxBudget;
        }
      }

      // Поиск в описании
      if (filterDto.search?.trim()) {
        where.description = {
          contains: filterDto.search.trim(),
          mode: 'insensitive',
        };
      }

      const [items, total] = await Promise.all([
        this.db.request.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: {
            student: {
              select: {
                id: true,
                name: true,
                telegramUsername: true,
              },
            },
            subject: {
              select: {
                id: true,
                name: true,
                isActive: true,
              },
            },
            teacher: {
              select: {
                id: true,
                fullName: true,
              },
            },
            responses: {
              select: {
                id: true,
                tutor: {
                  select: {
                    id: true,
                    name: true,
                    telegramUsername: true,
                  },
                },
                status: true,
                createdAt: true,
              },
            },
          },
        }),
        this.db.request.count({ where }),
      ]);

      return items;
    } catch (error) {
      this.logError('Ошибка получения списка заявок', error as Error, {
        filter: filterDto,
      });
      throw new BusinessException('Не удалось получить список заявок');
    }
  }

  async findOne(id: string): Promise<Request> {
    const request = await this.db.request.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            telegramUsername: true,
            createdAt: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
        teacher: {
          select: {
            id: true,
            fullName: true,
          },
        },
        responses: {
          select: {
            id: true,
            tutor: {
              select: {
                id: true,
                name: true,
                telegramUsername: true,
              },
            },
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Request', id);
    }

    return request;
  }

  async findOpenRequests(): Promise<Request[]> {
    return this.db.request.findMany({
      where: {
        deadline: {
          gte: new Date(),
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            telegramUsername: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
          },
        },
        teacher: {
          select: {
            id: true,
            fullName: true,
          },
        },
        responses: {
          select: {
            id: true,
            tutor: {
              select: {
                id: true,
                name: true,
                telegramUsername: true,
              },
            },
            status: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async findByStudent(studentId: string): Promise<Request[]> {
    return this.db.request.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
          },
        },
        teacher: {
          select: {
            id: true,
            fullName: true,
          },
        },
        responses: {
          select: {
            id: true,
            tutor: {
              select: {
                id: true,
                name: true,
                telegramUsername: true,
              },
            },
            status: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async update(
    id: string,
    updateRequestDto: UpdateRequestDto,
  ): Promise<Request> {
    try {
      // Проверяем существование заявки
      const existingRequest = await this.findOne(id);

      // Если изменяется предмет или преподаватель, проверяем связь
      if (updateRequestDto.subjectId || updateRequestDto.teacherId) {
        const newSubjectId =
          updateRequestDto.subjectId || existingRequest.subjectId;
        const newTeacherId =
          updateRequestDto.teacherId || existingRequest.teacherId;

        const teacherSubject = await this.db.teacherSubject.findFirst({
          where: {
            teacherId: newTeacherId,
            subjectId: newSubjectId,
            isActive: true,
          },
          include: {
            teacher: { select: { fullName: true } },
            subject: { select: { name: true } },
          },
        });

        if (!teacherSubject) {
          throw new BusinessException(
            'Указанный преподаватель не ведет данный предмет или связь неактивна',
          );
        }
      }

      const updatedRequest = await this.db.request.update({
        where: { id },
        data: {
          ...(updateRequestDto.studentId && {
            studentId: updateRequestDto.studentId,
          }),
          ...(updateRequestDto.subjectId && {
            subjectId: updateRequestDto.subjectId,
          }),
          ...(updateRequestDto.teacherId && {
            teacherId: updateRequestDto.teacherId,
          }),
          ...(updateRequestDto.description !== undefined && {
            description: updateRequestDto.description,
          }),
          ...(updateRequestDto.budget !== undefined && {
            budget: updateRequestDto.budget,
          }),
          ...(updateRequestDto.deadline && {
            deadline: updateRequestDto.deadline,
          }),
          updatedAt: new Date(),
        },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              telegramUsername: true,
            },
          },
          subject: {
            select: {
              id: true,
              name: true,
              isActive: true,
            },
          },
          teacher: {
            select: {
              id: true,
              fullName: true,
            },
          },
          responses: {
            select: {
              id: true,
              tutor: {
                select: {
                  id: true,
                  name: true,
                  telegramUsername: true,
                },
              },
              status: true,
              createdAt: true,
            },
          },
        },
      });

      this.logInfo('Заявка обновлена', { requestId: id, ...updateRequestDto });
      return updatedRequest;
    } catch (error) {
      if (
        error instanceof BusinessException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logError('Ошибка обновления заявки', error as Error, {
        id,
        ...updateRequestDto,
      });
      throw new BusinessException('Не удалось обновить заявку');
    }
  }

  async remove(id: string): Promise<void> {
    try {
      const request = await this.findOne(id);

      // TODO: Проверить активные отклики и сделки после обновления Prisma client

      await this.db.request.delete({
        where: { id },
      });

      this.logInfo('Заявка удалена', {
        requestId: id,
        studentId: request.studentId,
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BusinessException
      ) {
        throw error;
      }
      this.logError('Ошибка удаления заявки', error as Error, { id });
      throw new BusinessException('Не удалось удалить заявку');
    }
  }

  async getPopularRequests(limit: number = 10): Promise<Request[]> {
    return this.db.request.findMany({
      take: limit,
      // TODO: добавить сортировку по количеству откликов после обновления Prisma client
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            telegramUsername: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
          },
        },
        teacher: {
          select: {
            id: true,
            fullName: true,
          },
        },
        responses: {
          select: {
            id: true,
            tutor: {
              select: {
                id: true,
                name: true,
                telegramUsername: true,
              },
            },
            status: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async getRequestsBySubjectAndTeacher(
    subjectId: string,
    teacherId: string,
  ): Promise<Request[]> {
    return this.db.request.findMany({
      where: {
        subjectId,
        teacherId,
        // TODO: добавить фильтр по статусу OPEN после обновления Prisma client
      },
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            telegramUsername: true,
          },
        },
        responses: {
          select: {
            id: true,
            tutor: {
              select: {
                id: true,
                name: true,
                telegramUsername: true,
              },
            },
            status: true,
            createdAt: true,
          },
        },
      },
    });
  }
}

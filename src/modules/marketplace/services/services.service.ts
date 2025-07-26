import { Injectable } from '@nestjs/common';
import { Service, Prisma, ServiceStatus } from '@prisma/client';
import { DatabaseService } from '../../../database/database.service';
import {
  CreateServiceDto,
  UpdateServiceDto,
  ServiceFilterDto,
} from './dto/service.dto';
import {
  BaseService,
  BusinessException,
  NotFoundException,
  PaginatedResult,
  PaginationDto,
} from '@common';

@Injectable()
export class ServicesService extends BaseService {
  constructor(private readonly db: DatabaseService) {
    super();
  }

  async create(createServiceDto: CreateServiceDto): Promise<Service> {
    try {
      // Проверяем существование репетитора
      const tutor = await this.db.user.findUnique({
        where: { id: createServiceDto.tutorId },
      });

      if (!tutor) {
        throw new NotFoundException('User', createServiceDto.tutorId);
      }

      // Проверяем существование предмета и преподавателя
      const [subject, teacher] = await Promise.all([
        this.db.subject.findUnique({
          where: { id: createServiceDto.subjectId },
        }),
        this.db.teacher.findUnique({
          where: { id: createServiceDto.teacherId },
        }),
      ]);

      if (!subject) {
        throw new NotFoundException('Subject', createServiceDto.subjectId);
      }

      if (!teacher) {
        throw new NotFoundException('Teacher', createServiceDto.teacherId);
      }

      // Проверяем, что существует активная связь между преподавателем и предметом
      const teacherSubject = await this.db.teacherSubject.findFirst({
        where: {
          teacherId: createServiceDto.teacherId,
          subjectId: createServiceDto.subjectId,
          isActive: true,
        },
      });

      if (!teacherSubject) {
        throw new BusinessException(
          `Преподаватель "${teacher.fullName}" не ведет предмет "${subject.name}" или связь неактивна`,
        );
      }

      // Создаем услугу
      const service = await this.db.service.create({
        data: {
          ...createServiceDto,
          deadline: createServiceDto.deadline
            ? new Date(createServiceDto.deadline)
            : undefined,
        },
        include: {
          tutor: {
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
          _count: {
            select: {
              responses: true,
            },
          },
        },
      });

      this.logInfo('Создана новая услуга', {
        serviceId: service.id,
        tutorName: tutor.name,
        subjectName: subject.name,
        teacherName: teacher.fullName,
        price: service.price,
      });

      return service;
    } catch (error) {
      if (
        error instanceof BusinessException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logError('Ошибка создания услуги', error as Error, createServiceDto);
      throw new BusinessException('Не удалось создать услугу');
    }
  }

  async findAll(
    paginationDto: PaginationDto,
    filterDto: ServiceFilterDto,
  ): Promise<PaginatedResult<Service>> {
    try {
      const where: Prisma.ServiceWhereInput = {};

      // Фильтры
      if (filterDto.tutorId) {
        where.tutorId = filterDto.tutorId;
      }

      if (filterDto.subjectId) {
        where.subjectId = filterDto.subjectId;
      }

      if (filterDto.teacherId) {
        where.teacherId = filterDto.teacherId;
      }

      if (filterDto.status) {
        where.status = filterDto.status;
      }

      // Фильтр по цене
      if (
        filterDto.minPrice !== undefined ||
        filterDto.maxPrice !== undefined
      ) {
        where.price = {};
        if (filterDto.minPrice !== undefined) {
          where.price.gte = filterDto.minPrice;
        }
        if (filterDto.maxPrice !== undefined) {
          where.price.lte = filterDto.maxPrice;
        }
      }

      // Фильтр по дедлайну
      if (filterDto.deadlineAfter || filterDto.deadlineBefore) {
        where.deadline = {};
        if (filterDto.deadlineAfter) {
          where.deadline.gte = new Date(filterDto.deadlineAfter);
        }
        if (filterDto.deadlineBefore) {
          where.deadline.lte = new Date(filterDto.deadlineBefore);
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
        this.db.service.findMany({
          where,
          skip: paginationDto.skip,
          take: paginationDto.limit,
          orderBy: { createdAt: 'desc' },
          include: {
            tutor: {
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
            _count: {
              select: {
                responses: true,
              },
            },
          },
        }),
        this.db.service.count({ where }),
      ]);

      return {
        items,
        total,
        page: paginationDto.page,
        limit: paginationDto.limit,
        totalPages: Math.ceil(total / paginationDto.limit),
      };
    } catch (error) {
      this.logError('Ошибка получения списка услуг', error as Error, {
        pagination: paginationDto,
        filter: filterDto,
      });
      throw new BusinessException('Не удалось получить список услуг');
    }
  }

  async findOne(id: string): Promise<Service> {
    const service = await this.db.service.findUnique({
      where: { id },
      include: {
        tutor: {
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
        _count: {
          select: {
            responses: true,
          },
        },
      },
    });

    if (!service) {
      throw new NotFoundException('Service', id);
    }

    return service;
  }

  async findActiveServices(): Promise<Service[]> {
    return this.db.service.findMany({
      where: { status: ServiceStatus.ACTIVE },
      orderBy: { createdAt: 'desc' },
      include: {
        tutor: {
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
        _count: {
          select: {
            responses: true,
          },
        },
      },
    });
  }

  async findByTutor(tutorId: string): Promise<Service[]> {
    return this.db.service.findMany({
      where: { tutorId },
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
        _count: {
          select: {
            responses: true,
          },
        },
      },
    });
  }

  async update(
    id: string,
    updateServiceDto: UpdateServiceDto,
  ): Promise<Service> {
    try {
      // Проверяем существование услуги
      const existingService = await this.findOne(id);

      // Если изменяется предмет или преподаватель, проверяем связь
      if (updateServiceDto.subjectId || updateServiceDto.teacherId) {
        const newSubjectId =
          updateServiceDto.subjectId || existingService.subjectId;
        const newTeacherId =
          updateServiceDto.teacherId || existingService.teacherId;

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

      const updatedService = await this.db.service.update({
        where: { id },
        data: {
          ...updateServiceDto,
          deadline: updateServiceDto.deadline
            ? new Date(updateServiceDto.deadline)
            : undefined,
          updatedAt: new Date(),
        },
        include: {
          tutor: {
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
          _count: {
            select: {
              responses: true,
            },
          },
        },
      });

      this.logInfo('Услуга обновлена', { serviceId: id, ...updateServiceDto });
      return updatedService;
    } catch (error) {
      if (
        error instanceof BusinessException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logError('Ошибка обновления услуги', error as Error, {
        id,
        ...updateServiceDto,
      });
      throw new BusinessException('Не удалось обновить услугу');
    }
  }

  async activate(id: string): Promise<Service> {
    return this.update(id, { status: ServiceStatus.ACTIVE });
  }

  async deactivate(id: string): Promise<Service> {
    return this.update(id, { status: ServiceStatus.INACTIVE });
  }

  async suspend(id: string): Promise<Service> {
    return this.update(id, { status: ServiceStatus.SUSPENDED });
  }

  async remove(id: string): Promise<void> {
    try {
      const service = await this.findOne(id);

      // Проверяем, есть ли активные отклики или сделки
      const [responsesCount, dealsCount] = await Promise.all([
        this.db.serviceResponse.count({
          where: { serviceId: id, status: { in: ['PENDING', 'ACCEPTED'] } },
        }),
        this.db.deal.count({
          where: {
            serviceResponse: { serviceId: id },
          },
        }),
      ]);

      if (responsesCount > 0) {
        throw new BusinessException(
          'Нельзя удалить услугу с активными откликами. Деактивируйте ее вместо удаления.',
        );
      }

      if (dealsCount > 0) {
        throw new BusinessException(
          'Нельзя удалить услугу, по которой есть сделки. Деактивируйте ее вместо удаления.',
        );
      }

      await this.db.service.delete({
        where: { id },
      });

      this.logInfo('Услуга удалена', {
        serviceId: id,
        tutorId: service.tutorId,
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BusinessException
      ) {
        throw error;
      }
      this.logError('Ошибка удаления услуги', error as Error, { id });
      throw new BusinessException('Не удалось удалить услугу');
    }
  }

  async getServiceStats(serviceId: string) {
    const service = await this.findOne(serviceId);

    const [
      totalResponsesCount,
      acceptedResponsesCount,
      pendingResponsesCount,
      dealsCount,
    ] = await Promise.all([
      // Общее количество откликов
      this.db.serviceResponse.count({
        where: { serviceId },
      }),
      // Принятые отклики
      this.db.serviceResponse.count({
        where: { serviceId, status: 'ACCEPTED' },
      }),
      // Ожидающие отклики
      this.db.serviceResponse.count({
        where: { serviceId, status: 'PENDING' },
      }),
      // Сделки по этой услуге
      this.db.deal.count({
        where: {
          serviceResponse: { serviceId },
        },
      }),
    ]);

    return {
      service: {
        id: service.id,
        status: service.status,
        price: service.price,
        createdAt: service.createdAt,
        tutor: service.tutorId,
        subject: service.subjectId,
        teacher: service.teacherId,
      },
      stats: {
        totalResponses: totalResponsesCount,
        acceptedResponses: acceptedResponsesCount,
        pendingResponses: pendingResponsesCount,
        totalDeals: dealsCount,
        responseRate:
          totalResponsesCount > 0
            ? (acceptedResponsesCount / totalResponsesCount) * 100
            : 0,
      },
    };
  }

  async getPopularServices(limit: number = 10): Promise<Service[]> {
    return this.db.service.findMany({
      where: { status: ServiceStatus.ACTIVE },
      take: limit,
      orderBy: {
        responses: {
          _count: 'desc',
        },
      },
      include: {
        tutor: {
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
        _count: {
          select: {
            responses: true,
          },
        },
      },
    });
  }

  async getServicesBySubjectAndTeacher(
    subjectId: string,
    teacherId: string,
  ): Promise<Service[]> {
    return this.db.service.findMany({
      where: {
        subjectId,
        teacherId,
        status: ServiceStatus.ACTIVE,
      },
      orderBy: { price: 'asc' },
      include: {
        tutor: {
          select: {
            id: true,
            name: true,
            telegramUsername: true,
          },
        },
        _count: {
          select: {
            responses: true,
          },
        },
      },
    });
  }
}

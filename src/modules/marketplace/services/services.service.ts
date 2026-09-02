import { Injectable } from '@nestjs/common';
import { Service, Prisma, ServiceStatus } from '@prisma/client';
import { DatabaseService } from '../../../database/database.service';
import {
  CreateServiceDto,
  UpdateServiceDto,
  ServiceQueryDto,
} from './dto/service.dto';
import {
  BaseService,
  BusinessException,
  NotFoundException,
  PaginatedResult,
} from '@common';

@Injectable()
export class ServicesService extends BaseService {
  constructor(private readonly db: DatabaseService) {
    super();
  }

  async create(
    createServiceDto: CreateServiceDto,
    tutorId: string,
  ): Promise<Service> {
    try {
      // Проверяем существование репетитора
      const tutor = await this.db.user.findUnique({
        where: { id: tutorId },
      });

      if (!tutor) {
        throw new NotFoundException('User', tutorId);
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

      // TODO вернуть проверку
      // Проверяем, что существует активная связь между преподавателем и предметом
      // const teacherSubject = await this.db.teacherSubject.findFirst({
      //   where: {
      //     teacherId: createServiceDto.teacherId,
      //     subjectId: createServiceDto.subjectId,
      //     isActive: true,
      //   },
      // });

      // if (!teacherSubject) {
      //   throw new BusinessException(
      //     `Преподаватель "${teacher.fullName}" не ведет предмет "${subject.name}" или связь неактивна`,
      //   );
      // }

      // Создаем услугу
      const service = await this.db.service.create({
        data: {
          ...createServiceDto,
          lessonsCount: createServiceDto.lessonsCount,
          lessonDurationMinutes: createServiceDto.lessonDurationMinutes,
          tutorId,
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

  /**
   * Проставляет репетиторам рейтинг и число отзывов.
   * Отдельной колонки рейтинга у пользователя нет — считаем из отзывов одним
   * запросом на страницу, иначе витрина показывает всем «0.0».
   */
  private async attachTutorReputation(
    items: { tutor?: { id: string } | null }[],
  ): Promise<void> {
    const tutorIds = [
      ...new Set(
        items.map((i) => i.tutor?.id).filter((id): id is string => !!id),
      ),
    ];
    if (!tutorIds.length) return;

    const grouped = await this.db.review.groupBy({
      by: ['targetId'],
      where: { targetId: { in: tutorIds }, targetRole: 'TUTOR' },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const byId = new Map(
      grouped.map((row) => [
        row.targetId,
        {
          rating: Math.round((row._avg.rating ?? 0) * 10) / 10,
          reviewsCount: row._count.rating,
        },
      ]),
    );

    for (const item of items) {
      if (!item.tutor) continue;
      const reputation = byId.get(item.tutor.id);
      Object.assign(item.tutor, {
        rating: reputation?.rating ?? null,
        reviewsCount: reputation?.reviewsCount ?? 0,
      });
    }
  }

  async findAll(
    queryDto: ServiceQueryDto,
    currentUserId?: string,
  ): Promise<
    PaginatedResult<
      Service & { isOwnService?: boolean; currentUserResponded?: boolean }
    >
  > {
    try {
      const where: Prisma.ServiceWhereInput = {};

      // Фильтры
      if (queryDto.tutorId) {
        where.tutorId = queryDto.tutorId;
      }

      if (queryDto.subjectId) {
        where.subjectId = queryDto.subjectId;
      }

      if (queryDto.teacherId) {
        where.teacherId = queryDto.teacherId;
      }

      if (queryDto.status) {
        where.status = queryDto.status;
      } else {
        // По умолчанию для витрины показываем только активные услуги
        where.status = ServiceStatus.ACTIVE;
      }

      // Фильтр по цене
      if (queryDto.minPrice !== undefined || queryDto.maxPrice !== undefined) {
        where.price = {};
        if (queryDto.minPrice !== undefined) {
          where.price.gte = queryDto.minPrice;
        }
        if (queryDto.maxPrice !== undefined) {
          where.price.lte = queryDto.maxPrice;
        }
      }

      // Поиск в описании
      if (queryDto.search?.trim()) {
        where.description = {
          contains: queryDto.search.trim(),
          mode: 'insensitive',
        };
      }

      const [items, total] = await Promise.all([
        this.db.service.findMany({
          where,
          skip: queryDto.skip,
          take: queryDto.limit || 10,
          orderBy: { createdAt: 'desc' },
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
        }),
        this.db.service.count({ where }),
      ]);

      await this.attachTutorReputation(items);

      let resultItems = items;
      if (currentUserId != null) {
        const serviceIdsWithMyResponse = new Set(
          (
            await this.db.serviceResponse.findMany({
              where: {
                studentId: currentUserId,
                serviceId: { in: items.map((i) => i.id) },
              },
              select: { serviceId: true },
            })
          ).map((r) => r.serviceId),
        );
        resultItems = items.map((item) => ({
          ...item,
          isOwnService: item.tutorId === currentUserId,
          currentUserResponded: serviceIdsWithMyResponse.has(item.id),
        }));
      }

      return {
        items: resultItems,
        total,
        page: queryDto.page || 1,
        limit: queryDto.limit || 10,
        totalPages: Math.ceil(total / (queryDto.limit || 10)),
      };
    } catch (error) {
      this.logError('Ошибка получения списка услуг', error as Error, {
        query: queryDto,
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

    await this.attachTutorReputation([service]);

    return service;
  }

  async findActiveServices(
    currentUserId?: string,
  ): Promise<
    (Service & { isOwnService?: boolean; currentUserResponded?: boolean })[]
  > {
    const items = await this.db.service.findMany({
      where: { status: ServiceStatus.ACTIVE },
      orderBy: { createdAt: 'desc' },
      include: {
        tutor: {
          select: {
            createdAt: true,
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

    await this.attachTutorReputation(items);

    if (currentUserId != null) {
      const serviceIdsWithMyResponse = new Set(
        (
          await this.db.serviceResponse.findMany({
            where: {
              studentId: currentUserId,
              serviceId: { in: items.map((i) => i.id) },
            },
            select: { serviceId: true },
          })
        ).map((r) => r.serviceId),
      );
      return items.map((item) => ({
        ...item,
        isOwnService: item.tutorId === currentUserId,
        currentUserResponded: serviceIdsWithMyResponse.has(item.id),
      }));
    }
    return items;
  }

  async findByTutor(tutorId: string): Promise<Service[]> {
    return this.db.service.findMany({
      where: { tutorId },
      orderBy: { createdAt: 'desc' },
      include: {
        responses: {
          select: {
            id: true,
            status: true,
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
          ...(updateServiceDto.lessonsCount !== undefined && {
            lessonsCount: updateServiceDto.lessonsCount,
          }),
          ...(updateServiceDto.lessonDurationMinutes !== undefined && {
            lessonDurationMinutes: updateServiceDto.lessonDurationMinutes,
          }),
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

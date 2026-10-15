import { Injectable } from '@nestjs/common';
import { Prisma, ServiceResponse, User } from '@prisma/client';
import { DatabaseService } from '../../../database/database.service';
import {
  CreateServiceResponseDto,
  UpdateServiceResponseDto,
  ServiceResponseFilterDto,
} from './dto/service-response.dto';
import {
  BaseService,
  BusinessException,
  ForbiddenException,
  NotFoundException,
  PaginatedResult,
  PaginationDto,
} from '@common';
import { NotificationService } from '../../notifications/notification.service';

@Injectable()
export class ServiceResponsesService extends BaseService {
  constructor(
    private readonly db: DatabaseService,
    private readonly notificationService: NotificationService,
  ) {
    super();
  }

  async create(
    createServiceResponseDto: CreateServiceResponseDto,
  ): Promise<ServiceResponse> {
    try {
      // Проверяем существование студента и услуги
      const [student, service] = await Promise.all([
        this.db.user.findUnique({
          where: { id: createServiceResponseDto.studentId },
        }),
        this.db.service.findUnique({
          where: { id: createServiceResponseDto.serviceId },
          include: {
            tutor: { select: { id: true, name: true } },
            subject: { select: { name: true } },
            teacher: { select: { fullName: true } },
          },
        }),
      ]);

      if (!student) {
        throw new NotFoundException('User', createServiceResponseDto.studentId);
      }

      if (!service) {
        throw new NotFoundException(
          'Service',
          createServiceResponseDto.serviceId,
        );
      }

      // Проверяем, что услуга активна
      if (service.status !== 'ACTIVE') {
        throw new BusinessException('Нельзя откликаться на неактивную услугу');
      }

      // Проверяем, что студент не откликается на свою же услугу
      if (service.tutorId === createServiceResponseDto.studentId) {
        throw new BusinessException('Нельзя откликаться на собственную услугу');
      }

      // Проверяем, не существует ли уже отклик от этого студента на эту услугу
      const existingResponse = await this.db.serviceResponse.findFirst({
        where: {
          studentId: createServiceResponseDto.studentId,
          serviceId: createServiceResponseDto.serviceId,
        },
      });

      if (existingResponse) {
        throw new BusinessException(
          'Вы уже откликнулись на эту услугу. Можно редактировать существующий отклик.',
        );
      }

      // Создаем отклик
      const serviceResponse = await this.db.serviceResponse.create({
        data: {
          studentId: createServiceResponseDto.studentId,
          serviceId: createServiceResponseDto.serviceId,
          message: createServiceResponseDto.message,
          price: createServiceResponseDto.price,
          proposedDeadline: createServiceResponseDto.proposedDeadline
            ? new Date(createServiceResponseDto.proposedDeadline)
            : undefined,
          proposedDeadlineType: createServiceResponseDto.proposedDeadlineType,
          budgetType: createServiceResponseDto.budgetType,
          status: 'PENDING',
        },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              telegramUsername: true,
            },
          },
          service: {
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
            },
          },
          // TODO: добавить deal после обновления Prisma client
        },
      });

      this.logInfo('Создан новый отклик на услугу', {
        responseId: serviceResponse.id,
        studentName: student.name,
        serviceTutor: service.tutor.name,
        serviceSubject: service.subject.name,
        proposedPrice: serviceResponse.price,
      });

      void this.notificationService.notifyServiceResponseCreated({
        recipientUserId: service.tutorId,
        actorName: (student as { name: string }).name,
        actorUserId: createServiceResponseDto.studentId,
        subjectName: service.subject.name,
        studentId: createServiceResponseDto.studentId,
        serviceId: createServiceResponseDto.serviceId,
        responseId: serviceResponse.id,
        price:
          (serviceResponse as { price?: number | null }).price ??
          createServiceResponseDto.price ??
          null,
        message:
          (serviceResponse as { message?: string | null }).message ??
          createServiceResponseDto.message ??
          null,
        proposedDeadline:
          (serviceResponse as { proposedDeadline?: Date | string | null })
            .proposedDeadline ??
          createServiceResponseDto.proposedDeadline ??
          null,
      });

      return serviceResponse;
    } catch (error) {
      if (
        error instanceof BusinessException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logError(
        'Ошибка создания отклика на услугу',
        error instanceof Error ? error : undefined,
        createServiceResponseDto,
      );
      throw new BusinessException('Не удалось создать отклик на услугу');
    }
  }

  /**
   * Отклики, которые пользователь вправе видеть: свои (как студент) и отклики
   * на свои услуги (как репетитор). Фильтры сужают выдачу внутри этой области.
   */
  async findAll(
    paginationDto: PaginationDto,
    filterDto: ServiceResponseFilterDto,
    currentUserId: string,
  ): Promise<PaginatedResult<ServiceResponse>> {
    try {
      const asStudent: Prisma.ServiceResponseWhereInput = {
        studentId: currentUserId,
      };
      const asTutor: Prisma.ServiceResponseWhereInput = {
        service: { tutorId: currentUserId },
      };
      const scope =
        filterDto.role === 'student'
          ? asStudent
          : filterDto.role === 'tutor'
            ? asTutor
            : { OR: [asStudent, asTutor] };
      const where: Prisma.ServiceResponseWhereInput = { AND: [scope] };

      // Фильтры
      if (filterDto.studentId) {
        where.studentId = filterDto.studentId;
      }

      if (filterDto.serviceId) {
        where.serviceId = filterDto.serviceId;
      }

      if (filterDto.status) {
        where.status =
          filterDto.status as Prisma.ServiceResponseWhereInput['status'];
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

      // Поиск в сообщении
      if (filterDto.search?.trim()) {
        where.message = {
          contains: filterDto.search.trim(),
          mode: 'insensitive',
        };
      }

      const [items, total] = await Promise.all([
        this.db.serviceResponse.findMany({
          where,
          skip: paginationDto.skip,
          take: paginationDto.limit,
          orderBy: { createdAt: 'desc' },
          include: {
            student: {
              select: {
                id: true,
                name: true,
                telegramUsername: true,
              },
            },
            service: {
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
              },
            },
            // TODO: добавить deal после обновления Prisma client
          },
        }),
        this.db.serviceResponse.count({ where }),
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
        'Ошибка получения списка откликов на услуги',
        error as Error,
        {
          pagination: paginationDto,
          filter: filterDto,
        },
      );
      throw new BusinessException('Не удалось получить список откликов');
    }
  }

  async findOne(id: string): Promise<ServiceResponse> {
    const serviceResponse = await this.db.serviceResponse.findUnique({
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
        service: {
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
          },
        },
        // TODO: добавить deal после обновления Prisma client
      },
    });

    if (!serviceResponse) {
      throw new NotFoundException('ServiceResponse', id);
    }

    return serviceResponse;
  }

  /**
   * Отклик для чтения через API: видят только автор и владелец услуги.
   */
  async findOneForUser(id: string, userId: string): Promise<ServiceResponse> {
    const serviceResponse = await this.findOne(id);
    const tutorId = (
      serviceResponse as ServiceResponse & {
        service: { tutorId: string };
      }
    ).service.tutorId;
    if (serviceResponse.studentId !== userId && tutorId !== userId) {
      throw new ForbiddenException(
        'Отклик видят только его автор и владелец услуги',
      );
    }
    return serviceResponse;
  }

  async update(
    id: string,
    updateServiceResponseDto: UpdateServiceResponseDto,
  ): Promise<ServiceResponse> {
    try {
      // Проверяем существование отклика
      const existingResponse = await this.findOne(id);

      // Если отклик уже принят или отклонен, нельзя его изменять
      if (existingResponse.status !== 'PENDING') {
        throw new BusinessException(
          'Нельзя изменять отклик после принятия решения по нему',
        );
      }

      const updatedResponse = await this.db.serviceResponse.update({
        where: { id },
        data: {
          ...(updateServiceResponseDto.message !== undefined && {
            message: updateServiceResponseDto.message,
          }),
          ...(updateServiceResponseDto.price !== undefined && {
            price: updateServiceResponseDto.price,
          }),
          ...(updateServiceResponseDto.proposedDeadline !== undefined && {
            proposedDeadline: updateServiceResponseDto.proposedDeadline
              ? new Date(updateServiceResponseDto.proposedDeadline)
              : null,
          }),
          ...(updateServiceResponseDto.proposedDeadlineType !== undefined && {
            proposedDeadlineType: updateServiceResponseDto.proposedDeadlineType,
          }),
          ...(updateServiceResponseDto.budgetType !== undefined && {
            budgetType: updateServiceResponseDto.budgetType,
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
          service: {
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
            },
          },
          // TODO: добавить deal после обновления Prisma client
        },
      });

      this.logInfo('Отклик на услугу обновлен', {
        responseId: id,
        ...updateServiceResponseDto,
      });

      return updatedResponse;
    } catch (error) {
      if (
        error instanceof BusinessException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logError(
        'Ошибка обновления отклика на услугу',
        error instanceof Error ? error : undefined,
        {
          id,
          ...updateServiceResponseDto,
        },
      );
      throw new BusinessException('Не удалось обновить отклик на услугу');
    }
  }

  /**
   * Репетитор принимает запись на услугу.
   *
   * Принятие — это и есть сделка: без неё петля обрывалась на «принято»,
   * а витрина «Услуги» не давала ни подтверждения, ни отзыва. Цена берётся
   * из отклика, если студент предложил свою, иначе из услуги. Остальные
   * записи на ту же услугу не трогаем: услуга — это поток, а не одна вакансия.
   */
  async accept(id: string, user: User): Promise<ServiceResponse> {
    const response = await this.findOne(id);
    const responseWithService = response as ServiceResponse & {
      service?: {
        tutor?: { id: string; name: string };
        subject?: { name: string };
      };
    };
    const service = await this.db.service.findUnique({
      where: { id: response.serviceId },
      select: {
        tutorId: true,
        subjectId: true,
        teacherId: true,
        price: true,
        status: true,
      },
    });
    if (!service) {
      throw new NotFoundException('Service', response.serviceId);
    }
    const tutorId = String(service.tutorId);
    const userId = String(
      (user as { id?: string; sub?: string }).id ??
        (user as { id?: string; sub?: string }).sub ??
        '',
    );
    if (tutorId !== userId) {
      throw new ForbiddenException(
        'Только автор услуги может принимать отклики',
      );
    }
    if (response.status !== 'PENDING') {
      throw new BusinessException('Отклик уже обработан');
    }
    const existingDeal = await this.db.deal.findFirst({
      where: { serviceResponseId: id },
    });
    if (existingDeal) {
      throw new BusinessException('По этому отклику уже создана сделка');
    }
    const price = response.price ?? service.price;
    if (price == null || price < 100) {
      throw new BusinessException('Не указана цена для сделки');
    }

    await this.db.$transaction(async (tx) => {
      await tx.serviceResponse.update({
        where: { id },
        data: { status: 'ACCEPTED', updatedAt: new Date() },
      });
      await tx.deal.create({
        data: {
          studentId: response.studentId,
          tutorId,
          subjectId: service.subjectId,
          teacherId: service.teacherId,
          price,
          deadline: response.proposedDeadline ?? undefined,
          status: 'PENDING',
          serviceResponseId: id,
        },
      });
    });
    const deal = await this.db.deal.findFirst({
      where: { serviceResponseId: id },
    });

    void this.notificationService.notifyServiceResponseAccepted({
      recipientUserId: response.studentId,
      actorName: responseWithService.service?.tutor?.name ?? 'Репетитор',
      actorUserId: responseWithService.service?.tutor?.id ?? tutorId,
      responseId: id,
      serviceId: response.serviceId,
      dealId: deal?.id,
      subjectName: responseWithService.service?.subject?.name,
      price: deal?.price ?? price,
    });
    return this.findOne(id);
  }

  async reject(id: string, user: User): Promise<ServiceResponse> {
    const response = await this.findOne(id);
    const responseWithService = response as ServiceResponse & {
      service?: {
        tutor?: { id: string; name: string };
        subject?: { name: string };
      };
    };
    const service = await this.db.service.findUnique({
      where: { id: response.serviceId },
      select: { tutorId: true },
    });
    if (!service) {
      throw new NotFoundException('Service', response.serviceId);
    }
    const tutorId = String(service.tutorId);
    const userId = String(
      (user as { id?: string; sub?: string }).id ??
        (user as { id?: string; sub?: string }).sub ??
        '',
    );
    if (tutorId !== userId) {
      throw new ForbiddenException(
        'Только автор услуги может принимать отклики',
      );
    }
    if (response.status !== 'PENDING') {
      throw new BusinessException('Отклик уже обработан');
    }
    const updated = await this.setStatus(id, 'REJECTED');
    void this.notificationService.notifyServiceResponseRejected({
      recipientUserId: response.studentId,
      actorName: responseWithService.service?.tutor?.name ?? 'Репетитор',
      actorUserId: responseWithService.service?.tutor?.id ?? tutorId,
      responseId: id,
      subjectName: responseWithService.service?.subject?.name,
    });
    return updated;
  }

  async expire(id: string): Promise<ServiceResponse> {
    await this.findOne(id);
    return this.setStatus(id, 'EXPIRED');
  }

  /** Смена статуса — только для внутренних переходов (accept/reject/expire) */
  private setStatus(
    id: string,
    status: 'ACCEPTED' | 'REJECTED' | 'EXPIRED',
  ): Promise<ServiceResponse> {
    return this.db.serviceResponse.update({
      where: { id },
      data: { status, updatedAt: new Date() },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            telegramUsername: true,
          },
        },
        service: {
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
          },
        },
      },
    });
  }

  async remove(id: string): Promise<void> {
    try {
      const serviceResponse = await this.findOne(id);

      // Проверяем, что нет связанной сделки
      // TODO: добавить проверку deal после обновления Prisma client

      await this.db.serviceResponse.delete({
        where: { id },
      });

      this.logInfo('Отклик на услугу удален', {
        responseId: id,
        studentId: serviceResponse.studentId,
        serviceId: serviceResponse.serviceId,
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BusinessException
      ) {
        throw error;
      }
      this.logError(
        'Ошибка удаления отклика на услугу',
        error instanceof Error ? error : undefined,
        {
          id,
        },
      );
      throw new BusinessException('Не удалось удалить отклик на услугу');
    }
  }

  async getResponseStats(responseId: string) {
    const response = await this.findOne(responseId);

    // TODO: Реализовать статистику после обновления Prisma client
    return {
      response: {
        id: response.id,
        status: response.status,
        price: response.price,
        createdAt: response.createdAt,
        student: response.studentId,
        service: response.serviceId,
      },
      stats: {
        hasDeal: false,
        dealStatus: null,
      },
    };
  }

  async bulkExpire(
    serviceId: string,
    excludeIds: string[] = [],
  ): Promise<number> {
    try {
      const result = await this.db.serviceResponse.updateMany({
        where: {
          serviceId,
          status: 'PENDING',
          id: { notIn: excludeIds },
        },
        data: {
          status: 'EXPIRED',
          updatedAt: new Date(),
        },
      });

      this.logInfo('Массовое истечение откликов', {
        serviceId,
        excludedCount: excludeIds.length,
        expiredCount: result.count,
      });

      return result.count;
    } catch (error) {
      this.logError('Ошибка массового истечения откликов', error as Error, {
        serviceId,
        excludeIds,
      });
      throw new BusinessException('Не удалось обновить статусы откликов');
    }
  }
}

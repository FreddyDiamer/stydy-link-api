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
  NotFoundException,
  PaginatedResult,
  PaginationDto,
} from '@common';

@Injectable()
export class ServiceResponsesService extends BaseService {
  constructor(private readonly db: DatabaseService) {
    super();
  }

  async create(
    createServiceResponseDto: CreateServiceResponseDto,
  ): Promise<any> {
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
        error as Error,
        createServiceResponseDto,
      );
      throw new BusinessException('Не удалось создать отклик на услугу');
    }
  }

  async findAll(
    paginationDto: PaginationDto,
    filterDto: ServiceResponseFilterDto,
  ): Promise<PaginatedResult<any>> {
    try {
      const where: Prisma.ServiceResponseWhereInput = {};

      // Фильтры
      if (filterDto.studentId) {
        where.studentId = filterDto.studentId;
      }

      if (filterDto.serviceId) {
        where.serviceId = filterDto.serviceId;
      }

      if (filterDto.status) {
        where.status = filterDto.status as any; // TODO: исправить после обновления типов
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

  async findByStudent(studentId: string): Promise<ServiceResponse[]> {
    return this.db.serviceResponse.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      include: {
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
  }

  async findByService(serviceId: string): Promise<ServiceResponse[]> {
    return this.db.serviceResponse.findMany({
      where: { serviceId },
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            telegramUsername: true,
          },
        },
        // TODO: добавить deal после обновления Prisma client
      },
    });
  }

  async findPendingByService(serviceId: string): Promise<ServiceResponse[]> {
    return this.db.serviceResponse.findMany({
      where: {
        serviceId,
        status: 'PENDING',
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
      },
    });
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
          ...(updateServiceResponseDto.status && {
            status: updateServiceResponseDto.status as any,
          }),
          // TODO: добавить proposedDeadline после обновления Prisma client
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
      this.logError('Ошибка обновления отклика на услугу', error as Error, {
        id,
        ...updateServiceResponseDto,
      });
      throw new BusinessException('Не удалось обновить отклик на услугу');
    }
  }

  async accept(id: string, user: User): Promise<ServiceResponse> {
    // Проверяем, что отклик принимает владелец услуги
    const response = await this.findOne(id);
    const service = await this.db.service.findUnique({
      where: { id: response.serviceId },
    });

    if (!service) {
      throw new NotFoundException('Service', response.serviceId);
    }

    if (service.tutorId !== user.id) {
      throw new Error('Только автор услуги может принимать отклики');
    }
    return this.update(id, { status: 'ACCEPTED' as any });
  }

  async reject(id: string, user: User): Promise<ServiceResponse> {
    // Проверяем, что отклик принимает владелец услуги
    const response = await this.findOne(id);
    const service = await this.db.service.findUnique({
      where: { id: response.serviceId },
    });

    if (!service) {
      throw new NotFoundException('Service', response.serviceId);
    }

    if (service.tutorId !== user.id) {
      throw new Error('Только автор услуги может принимать отклики');
    }

    return this.update(id, { status: 'REJECTED' as any });
  }

  async expire(id: string): Promise<ServiceResponse> {
    return this.update(id, { status: 'EXPIRED' as any });
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
      this.logError('Ошибка удаления отклика на услугу', error as Error, {
        id,
      });
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

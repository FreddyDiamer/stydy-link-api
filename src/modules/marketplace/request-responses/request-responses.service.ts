import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import {
  CreateRequestResponseDto,
  UpdateRequestResponseDto,
  RequestResponseFilterDto,
} from './dto/request-response.dto';
import { BaseService, BusinessException, NotFoundException } from '@common';
import { Prisma, RequestResponse, User } from '@prisma/client';
import { NotificationService } from '../../notifications/notification.service';

@Injectable()
export class RequestResponsesService extends BaseService {
  constructor(
    private readonly db: DatabaseService,
    private readonly notificationService: NotificationService,
  ) {
    super();
  }

  async create(dto: CreateRequestResponseDto, user: User) {
    // Проверка существования репетитора и заявки
    const [tutor, request] = await Promise.all([
      this.db.user.findUnique({ where: { id: dto.tutorId } }),
      this.db.request.findUnique({
        where: { id: dto.requestId },
        include: { subject: { select: { name: true } } },
      }),
    ]);
    if (!tutor) throw new NotFoundException('User', dto.tutorId);
    if (!request) throw new NotFoundException('Request', dto.requestId);

    // Откликаться может только сам репетитор (текущий пользователь должен быть tutorId)
    if (dto.tutorId !== user.id) {
      throw new BusinessException(
        'Нельзя создать отклик от имени другого пользователя',
      );
    }

    // Нельзя откликаться на свою же заявку (студент не может откликнуться на свой заказ)
    if (request.studentId === user.id) {
      throw new BusinessException('Нельзя откликаться на свой заказ');
    }

    // Проверка на дубликат отклика
    const exists = await this.db.requestResponse.findFirst({
      where: { tutorId: dto.tutorId, requestId: dto.requestId },
    });
    if (exists)
      throw new BusinessException('Вы уже откликнулись на эту заявку.');
    // Создание отклика
    const created = await this.db.requestResponse.create({
      data: {
        tutorId: dto.tutorId,
        requestId: dto.requestId,
        message: dto.message,
        price: dto.price,
        proposedDeadline: dto.proposedDeadline,
        status: 'PENDING',
      },
    });
    const requestWithSubject = request as { subject?: { name: string } };
    void this.notificationService.notifyRequestResponseCreated({
      recipientUserId: request.studentId,
      actorName: (tutor as { name: string }).name,
      actorUserId: dto.tutorId,
      requestId: dto.requestId,
      responseId: created.id,
      subjectName: requestWithSubject.subject?.name,
      price: created.price ?? dto.price ?? null,
      message: created.message ?? dto.message ?? null,
      proposedDeadline:
        created.proposedDeadline ?? dto.proposedDeadline ?? null,
    });
    return created;
  }

  async findAll(filter: RequestResponseFilterDto): Promise<RequestResponse[]> {
    const where: Prisma.RequestResponseWhereInput = {};
    if (filter.tutorId) where.tutorId = filter.tutorId;
    if (filter.requestId) where.requestId = filter.requestId;
    if (filter.status)
      where.status =
        filter.status as Prisma.RequestResponseWhereInput['status'];
    if (filter.minPrice !== undefined || filter.maxPrice !== undefined) {
      where.price = {};
      if (filter.minPrice !== undefined) where.price.gte = filter.minPrice;
      if (filter.maxPrice !== undefined) where.price.lte = filter.maxPrice;
    }
    if (filter.search?.trim()) {
      where.message = { contains: filter.search.trim(), mode: 'insensitive' };
    }
    const items = await this.db.requestResponse.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return items;
  }

  async findByTutor(tutorId: string) {
    const items = await this.db.requestResponse.findMany({
      where: { tutorId },
      orderBy: { createdAt: 'desc' },
      include: {
        tutor: {
          select: {
            id: true,
            name: true,
            telegramUsername: true,
            avatarUrl: true,
          },
        },
        request: {
          include: {
            student: {
              select: {
                id: true,
                name: true,
                telegramUsername: true,
                avatarUrl: true,
              },
            },
            subject: { select: { id: true, name: true } },
            teacher: { select: { id: true, fullName: true } },
          },
        },
      },
    });
    return { items, total: items.length };
  }

  async findOne(id: string) {
    const item = await this.db.requestResponse.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('RequestResponse', id);
    return item;
  }

  async update(id: string, dto: UpdateRequestResponseDto) {
    await this.findOne(id);
    return this.db.requestResponse.update({
      where: { id },
      data: { ...dto, updatedAt: new Date() },
    });
  }

  async remove(id: string, user: User) {
    const item = await this.findOne(id);
    if (item.tutorId !== user.id) {
      throw new BusinessException('Можно удалить только свой отклик');
    }
    await this.db.requestResponse.delete({ where: { id } });
  }

  /** Принять отклик (студент): обновить статус и создать сделку */
  async accept(id: string, user: User) {
    const response = await this.db.requestResponse.findUnique({
      where: { id },
      include: {
        request: {
          include: {
            student: { select: { name: true } },
            subject: { select: { name: true } },
          },
        },
      },
    });
    if (!response) throw new NotFoundException('RequestResponse', id);
    if (response.request.studentId !== user.id) {
      throw new BusinessException('Только автор заявки может принять отклик');
    }
    if (response.status !== 'PENDING') {
      throw new BusinessException('Отклик уже обработан');
    }
    const existingDeal = await this.db.deal.findFirst({
      where: { requestResponseId: id },
    });
    if (existingDeal) {
      throw new BusinessException('По этому отклику уже создана сделка');
    }
    const price = response.price ?? response.request.budget;
    if (price == null || price < 100) {
      throw new BusinessException('Не указана цена для сделки');
    }
    await this.db.$transaction(async (tx) => {
      await tx.requestResponse.update({
        where: { id },
        data: { status: 'ACCEPTED', updatedAt: new Date() },
      });
      await tx.deal.create({
        data: {
          studentId: response.request.studentId,
          tutorId: response.tutorId,
          subjectId: response.request.subjectId,
          teacherId: response.request.teacherId,
          price,
          deadline:
            response.proposedDeadline ?? response.request.deadline ?? undefined,
          status: 'PENDING',
          requestResponseId: id,
        },
      });
    });
    const deal = await this.db.deal.findFirst({
      where: { requestResponseId: id },
    });
    const req = response.request as {
      subject?: { name: string };
      student?: { name: string };
    };
    void this.notificationService.notifyRequestResponseAccepted({
      recipientUserId: response.tutorId,
      actorName: req.student?.name ?? 'Студент',
      actorUserId: response.request.studentId,
      responseId: id,
      dealId: deal?.id ?? '',
      subjectName: req.subject?.name,
      price: deal?.price ?? undefined,
    });
    return this.db.requestResponse.findUnique({
      where: { id },
      include: {
        tutor: { select: { id: true, name: true, telegramUsername: true } },
        request: {
          include: {
            student: true,
            subject: true,
            teacher: true,
          },
        },
      },
    });
  }

  /** Отклонить отклик (студент) */
  async reject(id: string, user: User) {
    const response = await this.db.requestResponse.findUnique({
      where: { id },
      include: {
        request: {
          include: {
            student: { select: { name: true } },
            subject: { select: { name: true } },
          },
        },
      },
    });
    if (!response) throw new NotFoundException('RequestResponse', id);
    if (response.request.studentId !== user.id) {
      throw new BusinessException('Только автор заявки может отклонить отклик');
    }
    if (response.status !== 'PENDING') {
      throw new BusinessException('Отклик уже обработан');
    }
    const updated = await this.db.requestResponse.update({
      where: { id },
      data: { status: 'REJECTED', updatedAt: new Date() },
    });
    const requestWithSubject = response.request as {
      subject?: { name: string };
    };
    void this.notificationService.notifyRequestResponseRejected({
      recipientUserId: response.tutorId,
      actorName: response.request.student?.name ?? 'Студент',
      actorUserId: response.request.studentId,
      responseId: id,
      subjectName: requestWithSubject.subject?.name,
    });
    return updated;
  }

  /** Отменить принятый отклик (студент): отменить сделку и отклонить отклик */
  async cancel(id: string, user: User) {
    const response = await this.db.requestResponse.findUnique({
      where: { id },
      include: { request: true },
    });
    if (!response) throw new NotFoundException('RequestResponse', id);
    if (response.request.studentId !== user.id) {
      throw new BusinessException('Только автор заявки может отменить отклик');
    }
    if (response.status !== 'ACCEPTED') {
      throw new BusinessException('Можно отменить только принятый отклик');
    }
    const deal = await this.db.deal.findFirst({
      where: { requestResponseId: id },
    });
    if (!deal) {
      throw new BusinessException('Сделка не найдена');
    }
    if (deal.status === 'CANCELLED' || deal.status === 'COMPLETED') {
      throw new BusinessException('Сделка уже завершена или отменена');
    }
    await this.db.$transaction(async (tx) => {
      await tx.deal.update({
        where: { id: deal.id },
        data: { status: 'CANCELLED', updatedAt: new Date() },
      });
      await tx.requestResponse.update({
        where: { id },
        data: { status: 'REJECTED', updatedAt: new Date() },
      });
    });
    return this.db.requestResponse.findUnique({
      where: { id },
      include: {
        tutor: { select: { id: true, name: true, telegramUsername: true } },
        request: {
          include: {
            student: true,
            subject: true,
            teacher: true,
          },
        },
      },
    });
  }
}

import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { CreateDealDto, DealFilterDto } from './dto/deal.dto';
import {
  BaseService,
  BusinessException,
  ForbiddenException,
  NotFoundException,
  PaginatedResult,
  PaginationDto,
} from '@common';
import { Prisma } from '@prisma/client';
import { NotificationService } from '../../notifications/notification.service';

const DEAL_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

/** Deal with relations needed for notification payloads */
export interface DealWithRelations {
  studentId: string;
  tutorId: string;
  status: string;
  student?: { name: string };
  tutor?: { name: string };
  subject?: { name: string };
  price?: number | null;
}

@Injectable()
export class DealsService extends BaseService {
  constructor(
    private readonly db: DatabaseService,
    private readonly notificationService: NotificationService,
  ) {
    super();
  }

  async create(dto: CreateDealDto, initiatorUserId: string) {
    // Создавать сделку может только её участник
    if (initiatorUserId !== dto.studentId && initiatorUserId !== dto.tutorId) {
      throw new ForbiddenException(
        'Нельзя создавать сделки от имени других пользователей',
      );
    }
    // Проверка существования участников и связей
    const [student, tutor, subject, teacher] = await Promise.all([
      this.db.user.findUnique({ where: { id: dto.studentId } }),
      this.db.user.findUnique({ where: { id: dto.tutorId } }),
      this.db.subject.findUnique({ where: { id: dto.subjectId } }),
      this.db.teacher.findUnique({ where: { id: dto.teacherId } }),
    ]);
    if (!student) throw new NotFoundException('User', dto.studentId);
    if (!tutor) throw new NotFoundException('User', dto.tutorId);
    if (!subject) throw new NotFoundException('Subject', dto.subjectId);
    if (!teacher) throw new NotFoundException('Teacher', dto.teacherId);
    // Отклик должен принадлежать именно этой паре студент-репетитор
    if (dto.serviceResponseId) {
      const response = await this.db.serviceResponse.findUnique({
        where: { id: dto.serviceResponseId },
        include: { service: { select: { tutorId: true } } },
      });
      if (!response) {
        throw new NotFoundException('ServiceResponse', dto.serviceResponseId);
      }
      if (
        response.studentId !== dto.studentId ||
        response.service.tutorId !== dto.tutorId
      ) {
        throw new BusinessException(
          'Отклик не соответствует участникам сделки',
        );
      }
      const exists = await this.db.deal.findFirst({
        where: { serviceResponseId: dto.serviceResponseId },
      });
      if (exists)
        throw new BusinessException('Сделка по этому отклику уже существует.');
    }
    if (dto.requestResponseId) {
      const response = await this.db.requestResponse.findUnique({
        where: { id: dto.requestResponseId },
        include: { request: { select: { studentId: true } } },
      });
      if (!response) {
        throw new NotFoundException('RequestResponse', dto.requestResponseId);
      }
      if (
        response.tutorId !== dto.tutorId ||
        response.request.studentId !== dto.studentId
      ) {
        throw new BusinessException(
          'Отклик не соответствует участникам сделки',
        );
      }
      const exists = await this.db.deal.findFirst({
        where: { requestResponseId: dto.requestResponseId },
      });
      if (exists)
        throw new BusinessException('Сделка по этому отклику уже существует.');
    }
    // Создание сделки
    const deal = await this.db.deal.create({
      data: {
        studentId: dto.studentId,
        tutorId: dto.tutorId,
        subjectId: dto.subjectId,
        teacherId: dto.teacherId,
        price: dto.price,
        deadline: dto.deadline,
        status: 'PENDING',
        serviceResponseId: dto.serviceResponseId,
        requestResponseId: dto.requestResponseId,
      },
    });
    if (initiatorUserId && subject) {
      const recipientUserId =
        initiatorUserId === dto.studentId ? dto.tutorId : dto.studentId;
      const actorName =
        initiatorUserId === dto.studentId
          ? (student as { name: string }).name
          : (tutor as { name: string }).name;
      void this.notificationService.notifyDealCreated({
        recipientUserId,
        actorName,
        actorUserId: initiatorUserId,
        dealId: deal.id,
        subjectName: (subject as { name: string }).name,
        price: deal.price ?? undefined,
        deadline: deal.deadline ?? undefined,
      });
    }
    return deal;
  }

  async findAll(
    pagination: PaginationDto,
    filter: DealFilterDto,
    currentUserId: string,
  ): Promise<PaginatedResult<DealWithRelations>> {
    // Пользователь видит только сделки, в которых участвует сам
    const where: Prisma.DealWhereInput = {
      OR: [{ studentId: currentUserId }, { tutorId: currentUserId }],
    };
    if (filter.studentId) where.studentId = filter.studentId;
    if (filter.tutorId) where.tutorId = filter.tutorId;
    if (filter.subjectId) where.subjectId = filter.subjectId;
    if (filter.teacherId) where.teacherId = filter.teacherId;
    if (filter.status)
      where.status = filter.status as Prisma.DealWhereInput['status'];
    if (filter.minPrice !== undefined || filter.maxPrice !== undefined) {
      where.price = {};
      if (filter.minPrice !== undefined) where.price.gte = filter.minPrice;
      if (filter.maxPrice !== undefined) where.price.lte = filter.maxPrice;
    }
    const [items, total] = await Promise.all([
      this.db.deal.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          student: true,
          tutor: true,
          subject: true,
          teacher: true,
          serviceResponse: true,
          requestResponse: {
            include: {
              request: {
                include: {
                  student: true,
                  subject: true,
                  teacher: true,
                },
              },
            },
          },
          review: true,
        },
      }),
      this.db.deal.count({ where }),
    ]);
    return {
      items,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async findOne(id: string) {
    const item = await this.db.deal.findUnique({
      where: { id },
      include: {
        student: true,
        tutor: true,
        subject: true,
        teacher: true,
        serviceResponse: true,
        requestResponse: {
          include: {
            request: {
              include: {
                student: true,
                subject: true,
                teacher: true,
              },
            },
          },
        },
        review: true,
      },
    });
    if (!item) throw new NotFoundException('Deal', id);
    return item;
  }

  /** Получить сделку с проверкой, что пользователь — её участник */
  async findOneForUser(id: string, userId: string) {
    const deal = await this.findOne(id);
    if (deal.studentId !== userId && deal.tutorId !== userId) {
      throw new ForbiddenException('Вы не являетесь участником этой сделки');
    }
    return deal;
  }

  private async ensureDealParticipant(
    id: string,
    userId: string,
  ): Promise<DealWithRelations> {
    const deal = (await this.findOne(id)) as DealWithRelations;
    if (deal.studentId !== userId && deal.tutorId !== userId) {
      throw new ForbiddenException('Вы не являетесь участником этой сделки');
    }
    return deal;
  }

  async accept(id: string, userId: string) {
    const deal = await this.ensureDealParticipant(id, userId);
    if (deal.status !== DEAL_STATUS.PENDING) {
      throw new BusinessException(
        'Сделку можно принять только в статусе «Ожидание»',
      );
    }
    const updated = await this.db.deal.update({
      where: { id },
      data: { status: DEAL_STATUS.ACCEPTED, updatedAt: new Date() },
      include: {
        student: true,
        tutor: true,
        subject: true,
        teacher: true,
        serviceResponse: true,
        requestResponse: {
          include: {
            request: {
              include: { student: true, subject: true, teacher: true },
            },
          },
        },
        review: true,
      },
    });
    const recipientUserId =
      deal.studentId === userId ? deal.tutorId : deal.studentId;
    const actor = deal.studentId === userId ? deal.tutor : deal.student;
    void this.notificationService.notifyDealAccepted({
      recipientUserId,
      actorName: actor?.name ?? 'Участник',
      actorUserId: deal.studentId === userId ? deal.tutorId : deal.studentId,
      dealId: id,
      subjectName: deal.subject?.name,
      price: deal.price ?? undefined,
    });
    return updated;
  }

  async reject(id: string, userId: string) {
    await this.ensureDealParticipant(id, userId);
    const deal = (await this.findOne(id)) as DealWithRelations;
    if (deal.status !== DEAL_STATUS.PENDING) {
      throw new BusinessException(
        'Отклонить можно только сделку в статусе «Ожидание»',
      );
    }
    const updated = await this.db.deal.update({
      where: { id },
      data: { status: DEAL_STATUS.CANCELLED, updatedAt: new Date() },
      include: {
        student: true,
        tutor: true,
        subject: true,
        teacher: true,
        serviceResponse: true,
        requestResponse: {
          include: {
            request: {
              include: { student: true, subject: true, teacher: true },
            },
          },
        },
        review: true,
      },
    });
    const recipientUserId =
      deal.studentId === userId ? deal.tutorId : deal.studentId;
    const actor = deal.studentId === userId ? deal.tutor : deal.student;
    void this.notificationService.notifyDealRejectedOrCancelled({
      recipientUserId,
      actorName: actor?.name ?? 'Участник',
      actorUserId: deal.studentId === userId ? deal.tutorId : deal.studentId,
      dealId: id,
      subjectName: deal.subject?.name,
    });
    return updated;
  }

  async complete(id: string, userId: string) {
    await this.ensureDealParticipant(id, userId);
    const deal = (await this.findOne(id)) as DealWithRelations;
    if (
      deal.status !== DEAL_STATUS.ACCEPTED &&
      deal.status !== DEAL_STATUS.IN_PROGRESS
    ) {
      throw new BusinessException(
        'Завершить можно только принятую или активную сделку',
      );
    }
    const updated = await this.db.deal.update({
      where: { id },
      data: { status: DEAL_STATUS.COMPLETED, updatedAt: new Date() },
      include: {
        student: true,
        tutor: true,
        subject: true,
        teacher: true,
        serviceResponse: true,
        requestResponse: {
          include: {
            request: {
              include: { student: true, subject: true, teacher: true },
            },
          },
        },
        review: true,
      },
    });
    const recipientUserId =
      deal.studentId === userId ? deal.tutorId : deal.studentId;
    const actor = deal.studentId === userId ? deal.tutor : deal.student;
    void this.notificationService.notifyDealCompleted({
      recipientUserId,
      actorName: actor?.name ?? 'Участник',
      actorUserId: deal.studentId === userId ? deal.tutorId : deal.studentId,
      dealId: id,
      subjectName: deal.subject?.name,
    });
    return updated;
  }

  async cancel(id: string, userId: string) {
    await this.ensureDealParticipant(id, userId);
    const deal = (await this.findOne(id)) as DealWithRelations;
    if (
      deal.status === DEAL_STATUS.COMPLETED ||
      deal.status === DEAL_STATUS.CANCELLED
    ) {
      throw new BusinessException(
        'Нельзя отменить завершённую или уже отменённую сделку',
      );
    }
    const updated = await this.db.deal.update({
      where: { id },
      data: { status: DEAL_STATUS.CANCELLED, updatedAt: new Date() },
      include: {
        student: true,
        tutor: true,
        subject: true,
        teacher: true,
        serviceResponse: true,
        requestResponse: {
          include: {
            request: {
              include: { student: true, subject: true, teacher: true },
            },
          },
        },
        review: true,
      },
    });
    const recipientUserId =
      deal.studentId === userId ? deal.tutorId : deal.studentId;
    const actor = deal.studentId === userId ? deal.tutor : deal.student;
    void this.notificationService.notifyDealRejectedOrCancelled({
      recipientUserId,
      actorName: actor?.name ?? 'Участник',
      actorUserId: deal.studentId === userId ? deal.tutorId : deal.studentId,
      dealId: id,
      subjectName: deal.subject?.name,
    });
    return updated;
  }
}

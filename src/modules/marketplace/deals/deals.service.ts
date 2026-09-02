import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { CreateDealDto, UpdateDealDto, DealFilterDto } from './dto/deal.dto';
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
  studentConfirmedAt?: Date | null;
  tutorConfirmedAt?: Date | null;
  student?: { name: string };
  tutor?: { name: string };
  subject?: { name: string };
  price?: number | null;
}

/**
 * Сколько ждём вторую сторону, прежде чем закрыть сделку автоматически.
 * Без этого срока сторона, подтвердившая первой, оказывается заложником
 * молчания второй: сделка висит, отзыв не открывается.
 */
const AUTO_CONFIRM_DAYS = 3;

@Injectable()
export class DealsService extends BaseService {
  constructor(
    private readonly db: DatabaseService,
    private readonly notificationService: NotificationService,
  ) {
    super();
  }

  async create(dto: CreateDealDto, initiatorUserId?: string) {
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
    // Проверка на дубликат сделки по отклику
    if (dto.serviceResponseId) {
      const exists = await this.db.deal.findFirst({
        where: { serviceResponseId: dto.serviceResponseId },
      });
      if (exists)
        throw new BusinessException('Сделка по этому отклику уже существует.');
    }
    if (dto.requestResponseId) {
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
  ): Promise<PaginatedResult<DealWithRelations>> {
    await this.applyAutoConfirmations();

    const where: Prisma.DealWhereInput = {};
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
          reviews: true,
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
        reviews: true,
      },
    });
    if (!item) throw new NotFoundException('Deal', id);
    return item;
  }

  async update(id: string, dto: UpdateDealDto) {
    await this.findOne(id);
    return this.db.deal.update({
      where: { id },
      data: { ...dto, updatedAt: new Date() },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.db.deal.delete({ where: { id } });
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
        reviews: true,
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
        reviews: true,
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

  /**
   * Подтверждение выполнения со своей стороны.
   *
   * Сделка закрывается только когда отметились обе стороны — иначе рейтинг
   * можно было бы нарисовать в одиночку: создать сделку, закрыть её самому
   * и оставить себе отзыв. Если вторая сторона молчит дольше AUTO_CONFIRM_DAYS,
   * сделку закрывает авто-подтверждение (см. applyAutoConfirmations).
   */
  async complete(id: string, userId: string) {
    await this.ensureDealParticipant(id, userId);
    const deal = (await this.findOne(id)) as DealWithRelations;
    if (
      deal.status === DEAL_STATUS.COMPLETED ||
      deal.status === DEAL_STATUS.CANCELLED
    ) {
      throw new BusinessException('Сделка уже завершена или отменена');
    }

    const isStudent = deal.studentId === userId;
    const alreadyConfirmed = isStudent
      ? deal.studentConfirmedAt
      : deal.tutorConfirmedAt;
    if (alreadyConfirmed) {
      throw new BusinessException('Вы уже подтвердили выполнение');
    }

    const now = new Date();
    const counterpartConfirmed = isStudent
      ? deal.tutorConfirmedAt
      : deal.studentConfirmedAt;
    const bothConfirmed = Boolean(counterpartConfirmed);

    const updated = await this.db.deal.update({
      where: { id },
      data: {
        ...(isStudent
          ? { studentConfirmedAt: now }
          : { tutorConfirmedAt: now }),
        ...(bothConfirmed ? { status: DEAL_STATUS.COMPLETED } : {}),
        updatedAt: now,
      },
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
        reviews: true,
      },
    });
    const recipientUserId = isStudent ? deal.tutorId : deal.studentId;
    const actor = isStudent ? deal.student : deal.tutor;
    void this.notificationService.notifyDealCompleted({
      recipientUserId,
      actorName: actor?.name ?? 'Участник',
      actorUserId: userId,
      dealId: id,
      subjectName: deal.subject?.name,
    });
    return updated;
  }

  /**
   * Закрывает сделки, где одна сторона подтвердила выполнение, а вторая
   * молчит дольше AUTO_CONFIRM_DAYS. Вызывается при чтении списка сделок,
   * чтобы не тащить в проект планировщик ради одной операции.
   */
  private async applyAutoConfirmations(): Promise<void> {
    const deadline = new Date(
      Date.now() - AUTO_CONFIRM_DAYS * 24 * 60 * 60 * 1000,
    );
    try {
      await this.db.deal.updateMany({
        where: {
          status: {
            in: [
              DEAL_STATUS.PENDING,
              DEAL_STATUS.ACCEPTED,
              DEAL_STATUS.IN_PROGRESS,
            ],
          },
          OR: [
            { studentConfirmedAt: { lt: deadline }, tutorConfirmedAt: null },
            { tutorConfirmedAt: { lt: deadline }, studentConfirmedAt: null },
          ],
        },
        data: { status: DEAL_STATUS.COMPLETED, updatedAt: new Date() },
      });
    } catch (error) {
      // авто-подтверждение не должно ронять выдачу списка сделок
      this.logError(
        'Не удалось применить авто-подтверждение сделок',
        error as Error,
      );
    }
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
        reviews: true,
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

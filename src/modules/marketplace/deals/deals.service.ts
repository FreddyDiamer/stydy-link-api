import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../../../database/database.service';
import { DealFilterDto } from './dto/deal.dto';
import { PUBLIC_USER_SELECT } from '../../users/users.service';
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
 *
 * Отсчёт идёт от подтверждения ИЛИ от дедлайна сделки — что позже. Работа
 * бывает длинной (диплом пишут месяцами), и закрывать её раньше собственного
 * срока нельзя, даже если кто-то отметился первым.
 */
const AUTO_CONFIRM_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Момент, когда сделка закроется без второй стороны (null — таймер не идёт). */
function autoConfirmAt(deal: {
  status: string;
  deadline?: Date | null;
  studentConfirmedAt?: Date | null;
  tutorConfirmedAt?: Date | null;
}): Date | null {
  if (deal.status === 'COMPLETED' || deal.status === 'CANCELLED') return null;

  const confirmed = deal.studentConfirmedAt ?? deal.tutorConfirmedAt;
  const bothConfirmed = !!deal.studentConfirmedAt && !!deal.tutorConfirmedAt;
  if (!confirmed || bothConfirmed) return null;

  const from =
    deal.deadline && deal.deadline > confirmed ? deal.deadline : confirmed;
  return new Date(from.getTime() + AUTO_CONFIRM_DAYS * DAY_MS);
}

@Injectable()
export class DealsService extends BaseService {
  constructor(
    private readonly db: DatabaseService,
    private readonly notificationService: NotificationService,
  ) {
    super();
  }

  async findAll(
    pagination: PaginationDto,
    filter: DealFilterDto,
    currentUserId: string,
  ): Promise<PaginatedResult<DealWithRelations>> {
    await this.applyAutoConfirmations();

    // Пользователь видит только сделки, в которых участвует сам
    const where: Prisma.DealWhereInput = {
      OR: [{ studentId: currentUserId }, { tutorId: currentUserId }],
    };
    if (filter.studentId) where.studentId = filter.studentId;
    if (filter.tutorId) where.tutorId = filter.tutorId;
    if (filter.role === 'tutor') where.tutorId = currentUserId;
    if (filter.role === 'student') where.studentId = currentUserId;
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
          student: { select: PUBLIC_USER_SELECT },
          tutor: { select: PUBLIC_USER_SELECT },
          subject: true,
          teacher: true,
          serviceResponse: true,
          requestResponse: {
            include: {
              request: {
                include: {
                  student: { select: PUBLIC_USER_SELECT },
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

    const withTimer = items.map((item) => ({
      ...item,
      autoConfirmAt: autoConfirmAt(item),
    }));
    return {
      items: withTimer,
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
        student: { select: PUBLIC_USER_SELECT },
        tutor: { select: PUBLIC_USER_SELECT },
        subject: true,
        teacher: true,
        serviceResponse: true,
        requestResponse: {
          include: {
            request: {
              include: {
                student: { select: PUBLIC_USER_SELECT },
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

  /** Получить сделку с проверкой, что пользователь — её участник */
  async findOneForUser(id: string, userId: string) {
    await this.applyAutoConfirmations();
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
        student: { select: PUBLIC_USER_SELECT },
        tutor: { select: PUBLIC_USER_SELECT },
        subject: true,
        teacher: true,
        serviceResponse: true,
        requestResponse: {
          include: {
            request: {
              include: {
                student: { select: PUBLIC_USER_SELECT },
                subject: true,
                teacher: true,
              },
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
        student: { select: PUBLIC_USER_SELECT },
        tutor: { select: PUBLIC_USER_SELECT },
        subject: true,
        teacher: true,
        serviceResponse: true,
        requestResponse: {
          include: {
            request: {
              include: {
                student: { select: PUBLIC_USER_SELECT },
                subject: true,
                teacher: true,
              },
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
   * «Работа ещё не готова»: снимает подтверждение второй стороны и
   * останавливает таймер авто-закрытия. Нужно для длинной работы — диплом
   * пишут месяцами, и преждевременное «сдал» не должно закрывать сделку.
   */
  async reopen(id: string, userId: string) {
    const deal = await this.ensureDealParticipant(id, userId);
    if (
      deal.status === DEAL_STATUS.COMPLETED ||
      deal.status === DEAL_STATUS.CANCELLED
    ) {
      throw new BusinessException('Сделка уже завершена или отменена');
    }

    const isStudent = deal.studentId === userId;
    const theirConfirmedAt = isStudent
      ? deal.tutorConfirmedAt
      : deal.studentConfirmedAt;
    if (!theirConfirmedAt) {
      throw new BusinessException(
        'Вторая сторона ещё не подтверждала выполнение',
      );
    }

    const updated = await this.db.deal.update({
      where: { id },
      data: {
        ...(isStudent
          ? { tutorConfirmedAt: null }
          : { studentConfirmedAt: null }),
        updatedAt: new Date(),
      },
      include: {
        student: { select: PUBLIC_USER_SELECT },
        tutor: { select: PUBLIC_USER_SELECT },
        subject: true,
        teacher: true,
        serviceResponse: true,
        requestResponse: {
          include: {
            request: {
              include: {
                student: { select: PUBLIC_USER_SELECT },
                subject: true,
                teacher: true,
              },
            },
          },
        },
        reviews: true,
      },
    });

    const actor = isStudent ? deal.student : deal.tutor;
    void this.notificationService.notifyDealReopened({
      recipientUserId: isStudent ? deal.tutorId : deal.studentId,
      actorName: actor?.name ?? 'Участник',
      actorUserId: userId,
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
        student: { select: PUBLIC_USER_SELECT },
        tutor: { select: PUBLIC_USER_SELECT },
        subject: true,
        teacher: true,
        serviceResponse: true,
        requestResponse: {
          include: {
            request: {
              include: {
                student: { select: PUBLIC_USER_SELECT },
                subject: true,
                teacher: true,
              },
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
   * Планировщик: авто-подтверждение не должно зависеть от того, откроет ли
   * кто-то список сделок. Раз в час достаточно — срок считается днями.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async autoConfirmSweep(): Promise<void> {
    await this.applyAutoConfirmations();
  }

  /**
   * Закрывает сделки, где одна сторона подтвердила выполнение, а вторая
   * молчит дольше AUTO_CONFIRM_DAYS. Вызывается планировщиком и при чтении
   * сделок, чтобы выдача никогда не показывала просроченный статус.
   * Обе стороны получают уведомление о закрытии — иначе молчавшая сторона
   * не узнает, что отзыв уже открыт.
   */
  private async applyAutoConfirmations(): Promise<void> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - AUTO_CONFIRM_DAYS * DAY_MS);
    const where: Prisma.DealWhereInput = {
      status: {
        in: [
          DEAL_STATUS.PENDING,
          DEAL_STATUS.ACCEPTED,
          DEAL_STATUS.IN_PROGRESS,
        ],
      },
      AND: [
        // одна сторона подтвердила и молчание длится дольше срока
        {
          OR: [
            { studentConfirmedAt: { lt: cutoff }, tutorConfirmedAt: null },
            { tutorConfirmedAt: { lt: cutoff }, studentConfirmedAt: null },
          ],
        },
        // но не раньше собственного срока сделки: длинную работу
        // нельзя закрыть до дедлайна
        { OR: [{ deadline: null }, { deadline: { lt: cutoff } }] },
      ],
    };
    try {
      const expired = await this.db.deal.findMany({
        where,
        select: {
          id: true,
          studentId: true,
          tutorId: true,
          subject: { select: { name: true } },
        },
      });
      if (!expired.length) return;

      await this.db.deal.updateMany({
        where: { id: { in: expired.map((d) => d.id) } },
        data: { status: DEAL_STATUS.COMPLETED, updatedAt: new Date() },
      });

      for (const deal of expired) {
        for (const recipientUserId of [deal.studentId, deal.tutorId]) {
          void this.notificationService.notifyDealCompleted({
            recipientUserId,
            actorName: 'Study Link',
            actorUserId: recipientUserId,
            dealId: deal.id,
            subjectName: deal.subject?.name,
          });
        }
      }
    } catch (error) {
      // авто-подтверждение не должно ронять выдачу списка сделок
      this.logError(
        'Не удалось применить авто-подтверждение сделок',
        error as Error,
      );
    }
  }

  async cancel(id: string, userId: string, reason?: string) {
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
      data: {
        status: DEAL_STATUS.CANCELLED,
        cancelledAt: new Date(),
        cancelledById: userId,
        cancelReason: reason,
        updatedAt: new Date(),
      },
      include: {
        student: { select: PUBLIC_USER_SELECT },
        tutor: { select: PUBLIC_USER_SELECT },
        subject: true,
        teacher: true,
        serviceResponse: true,
        requestResponse: {
          include: {
            request: {
              include: {
                student: { select: PUBLIC_USER_SELECT },
                subject: true,
                teacher: true,
              },
            },
          },
        },
        reviews: true,
      },
    });
    const recipientUserId =
      deal.studentId === userId ? deal.tutorId : deal.studentId;
    const actor = deal.studentId === userId ? deal.student : deal.tutor;
    void this.notificationService.notifyDealRejectedOrCancelled({
      recipientUserId,
      actorName: actor?.name ?? 'Участник',
      actorUserId: userId,
      dealId: id,
      subjectName: deal.subject?.name,
    });
    return updated;
  }
}

import { Injectable } from '@nestjs/common';
import { Review, Prisma, UserRole } from '@prisma/client';
import { DatabaseService } from '../../database/database.service';
import {
  CreateReviewDto,
  UpdateReviewDto,
  SetReviewReplyDto,
  ReviewFilterDto,
} from './dto/review.dto';
import {
  BaseService,
  BusinessException,
  ForbiddenException,
  NotFoundException,
  PaginatedResult,
  PaginationDto,
} from '@common';
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class ReviewsService extends BaseService {
  constructor(
    private readonly db: DatabaseService,
    private readonly notificationService: NotificationService,
  ) {
    super();
  }

  /**
   * Отзыв по завершённой сделке. Автор — текущий пользователь, получатель и его
   * роль выводятся из сделки: клиент их не присылает, иначе рейтинг можно было бы
   * приписать кому угодно и в любой роли.
   */
  async create(
    createReviewDto: CreateReviewDto,
    authorId: string,
  ): Promise<Review> {
    try {
      // Проверяем существование сделки
      const deal = await this.db.deal.findUnique({
        where: { id: createReviewDto.dealId },
        include: {
          student: { select: { id: true, name: true } },
          tutor: { select: { id: true, name: true } },
        },
      });

      if (!deal) {
        throw new NotFoundException('Deal', createReviewDto.dealId);
      }

      // Проверяем, что сделка завершена
      if (deal.status !== 'COMPLETED') {
        throw new BusinessException(
          'Отзыв можно оставить только по завершенной сделке',
        );
      }

      // Проверяем, что автор участвует в сделке
      if (deal.studentId !== authorId && deal.tutorId !== authorId) {
        throw new BusinessException(
          'Отзыв может оставить только участник сделки',
        );
      }

      // Получатель — вторая сторона сделки, его роль однозначна
      const authorIsStudent = deal.studentId === authorId;
      const targetId = authorIsStudent ? deal.tutorId : deal.studentId;
      const targetRole: UserRole = authorIsStudent
        ? UserRole.TUTOR
        : UserRole.STUDENT;

      // По одному отзыву с каждой стороны
      const existingReview = await this.db.review.findFirst({
        where: { dealId: createReviewDto.dealId, authorId },
      });

      if (existingReview) {
        throw new BusinessException('Вы уже оставили отзыв по этой сделке');
      }

      // Создаем отзыв
      const review = await this.db.review.create({
        data: {
          dealId: createReviewDto.dealId,
          rating: createReviewDto.rating,
          comment: createReviewDto.comment,
          authorId,
          targetId,
          targetRole,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              telegramUsername: true,
            },
          },
          target: {
            select: {
              id: true,
              name: true,
              telegramUsername: true,
            },
          },
          deal: {
            include: {
              subject: { select: { name: true } },
              teacher: { select: { fullName: true } },
            },
          },
        },
      });

      this.logInfo('Создан новый отзыв', {
        reviewId: review.id,
        authorName: review.author.name,
        targetName: review.target.name,
        rating: review.rating,
        targetRole: review.targetRole,
      });

      const dealData = review.deal as
        | { subject?: { name: string } }
        | undefined;
      void this.notificationService.notifyReviewCreated({
        recipientUserId: review.targetId,
        actorName: review.author.name,
        actorUserId: review.authorId,
        reviewId: review.id,
        dealId: review.dealId,
        subjectName: dealData?.subject?.name,
        rating: review.rating,
        comment: review.comment ?? null,
      });

      return review;
    } catch (error) {
      if (
        error instanceof BusinessException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logError('Ошибка создания отзыва', error as Error, createReviewDto);
      throw error;
    }
  }

  async findAll(
    paginationDto: PaginationDto,
    filterDto: ReviewFilterDto,
  ): Promise<PaginatedResult<Review>> {
    try {
      const where: Prisma.ReviewWhereInput = {};

      // Фильтры
      if (filterDto.authorId) {
        where.authorId = filterDto.authorId;
      }

      if (filterDto.targetId) {
        where.targetId = filterDto.targetId;
      }

      if (filterDto.targetRole) {
        where.targetRole =
          filterDto.targetRole as Prisma.ReviewWhereInput['targetRole'];
      }

      // Фильтр по рейтингу
      if (
        filterDto.minRating !== undefined ||
        filterDto.maxRating !== undefined
      ) {
        where.rating = {};
        if (filterDto.minRating !== undefined) {
          where.rating.gte = filterDto.minRating;
        }
        if (filterDto.maxRating !== undefined) {
          where.rating.lte = filterDto.maxRating;
        }
      }

      // Поиск в комментарии
      if (filterDto.search?.trim()) {
        where.comment = {
          contains: filterDto.search.trim(),
          mode: 'insensitive',
        };
      }

      const [items, total] = await Promise.all([
        this.db.review.findMany({
          where,
          skip: paginationDto.skip,
          take: paginationDto.limit,
          orderBy: { createdAt: 'desc' },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                telegramUsername: true,
              },
            },
            target: {
              select: {
                id: true,
                name: true,
                telegramUsername: true,
              },
            },
            deal: {
              include: {
                subject: { select: { name: true } },
                teacher: { select: { fullName: true } },
              },
            },
          },
        }),
        this.db.review.count({ where }),
      ]);

      return {
        items,
        total,
        page: paginationDto.page,
        limit: paginationDto.limit,
        totalPages: Math.ceil(total / paginationDto.limit),
      };
    } catch (error) {
      this.logError('Ошибка получения списка отзывов', error as Error, {
        pagination: paginationDto,
        filter: filterDto,
      });
      throw error;
    }
  }

  async findOne(id: string): Promise<Review> {
    const review = await this.db.review.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            telegramUsername: true,
            createdAt: true,
          },
        },
        target: {
          select: {
            id: true,
            name: true,
            telegramUsername: true,
            createdAt: true,
          },
        },
        deal: {
          include: {
            subject: { select: { name: true } },
            teacher: { select: { fullName: true } },
          },
        },
      },
    });

    if (!review) {
      throw new NotFoundException('Review', id);
    }

    return review;
  }

  async findByTarget(
    targetId: string,
    targetRole?: 'TUTOR' | 'STUDENT',
  ): Promise<Review[]> {
    const where: { targetId: string; targetRole?: 'TUTOR' | 'STUDENT' } = {
      targetId,
    };
    if (targetRole) {
      where.targetRole = targetRole;
    }
    return this.db.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            telegramUsername: true,
          },
        },
        deal: {
          include: {
            subject: { select: { name: true } },
            teacher: { select: { fullName: true } },
          },
        },
      },
    });
  }

  async findByAuthor(authorId: string): Promise<Review[]> {
    return this.db.review.findMany({
      where: { authorId },
      orderBy: { createdAt: 'desc' },
      include: {
        target: {
          select: {
            id: true,
            name: true,
            telegramUsername: true,
          },
        },
        deal: {
          include: {
            subject: { select: { name: true } },
            teacher: { select: { fullName: true } },
          },
        },
      },
    });
  }

  async findByDeal(dealId: string): Promise<Review[]> {
    return this.db.review.findMany({
      where: { dealId },
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            telegramUsername: true,
          },
        },
        target: {
          select: {
            id: true,
            name: true,
            telegramUsername: true,
          },
        },
        deal: {
          include: {
            subject: { select: { name: true } },
            teacher: { select: { fullName: true } },
          },
        },
      },
    });
  }

  async update(id: string, updateReviewDto: UpdateReviewDto): Promise<Review> {
    try {
      // Проверяем существование отзыва
      await this.findOne(id);

      // Сделку менять нельзя; автор, получатель и роль вообще не принимаются
      // от клиента — они выводятся при создании
      if (updateReviewDto.dealId) {
        throw new BusinessException(
          'Нельзя изменять сделку отзыва после создания',
        );
      }

      const updatedReview = await this.db.review.update({
        where: { id },
        data: {
          ...(updateReviewDto.rating !== undefined && {
            rating: updateReviewDto.rating,
          }),
          ...(updateReviewDto.comment !== undefined && {
            comment: updateReviewDto.comment,
          }),
          updatedAt: new Date(),
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              telegramUsername: true,
            },
          },
          target: {
            select: {
              id: true,
              name: true,
              telegramUsername: true,
            },
          },
          deal: {
            include: {
              subject: { select: { name: true } },
              teacher: { select: { fullName: true } },
            },
          },
        },
      });

      this.logInfo('Отзыв обновлен', { reviewId: id, ...updateReviewDto });
      return updatedReview;
    } catch (error) {
      if (
        error instanceof BusinessException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logError('Ошибка обновления отзыва', error as Error, {
        id,
        ...updateReviewDto,
      });
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.findOne(id);

      await this.db.review.delete({
        where: { id },
      });

      this.logInfo('Отзыв удален', { reviewId: id });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logError('Ошибка удаления отзыва', error as Error, { id });
      throw error;
    }
  }

  async setReply(
    id: string,
    userId: string,
    dto: SetReviewReplyDto,
  ): Promise<Review> {
    const review = (await this.findOne(id)) as {
      targetId: string;
      authorId: string;
      dealId: string;
    };
    if (review.targetId !== userId) {
      throw new ForbiddenException(
        'Ответ на отзыв может оставить только репетитор, которому оставлен отзыв',
      );
    }
    const replyValue =
      dto.reply === undefined
        ? undefined
        : dto.reply === '' || dto.reply === null
          ? null
          : dto.reply;
    const updated = await this.db.review.update({
      where: { id },
      data: {
        ...(replyValue !== undefined ? { reply: replyValue } : {}),
        updatedAt: new Date(),
      },
      include: {
        author: { select: { id: true, name: true, telegramUsername: true } },
        target: { select: { id: true, name: true, telegramUsername: true } },
        deal: {
          include: {
            subject: { select: { name: true } },
            teacher: { select: { fullName: true } },
          },
        },
      },
    });
    this.logInfo('Ответ на отзыв обновлен', { reviewId: id });
    const updatedWithRelations = updated as Review & {
      authorId: string;
      target?: { name: string };
      targetId: string;
      dealId: string;
      deal?: { subject?: { name: string } };
    };
    const updatedDeal = updatedWithRelations.deal;
    void this.notificationService.notifyReviewReply({
      recipientUserId: updatedWithRelations.authorId,
      actorName: updatedWithRelations.target?.name ?? 'Репетитор',
      actorUserId: updatedWithRelations.targetId,
      reviewId: id,
      dealId: updatedWithRelations.dealId ?? review.dealId,
      subjectName: updatedDeal?.subject?.name,
    });
    return updated;
  }

  async getTargetStats(targetId: string, targetRole?: 'TUTOR' | 'STUDENT') {
    const where: { targetId: string; targetRole?: 'TUTOR' | 'STUDENT' } = {
      targetId,
    };
    if (targetRole) {
      where.targetRole = targetRole;
    }
    const [reviews, avgRating, ratingDistribution] = await Promise.all([
      this.db.review.findMany({
        where,
        select: { rating: true, createdAt: true },
      }),
      this.db.review.aggregate({
        where,
        _avg: { rating: true },
      }),
      this.db.review.groupBy({
        by: ['rating'],
        where,
        _count: { rating: true },
      }),
    ]);

    return {
      totalReviews: reviews.length,
      averageRating: avgRating._avg.rating || 0,
      ratingDistribution: ratingDistribution.reduce(
        (acc, item) => {
          acc[item.rating] = item._count.rating;
          return acc;
        },
        { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>,
      ),
      recentReviews: reviews
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 5),
    };
  }

  /**
   * Две репутации пользователя: как исполнителя и как заказчика.
   * Считается из отзывов — отдельной колонки рейтинга у пользователя нет.
   */
  async getReputation(targetId: string) {
    const [asTutor, asStudent] = await Promise.all([
      this.getTargetStats(targetId, 'TUTOR'),
      this.getTargetStats(targetId, 'STUDENT'),
    ]);

    const round = (value: number) => Math.round(value * 10) / 10;

    return {
      tutor: {
        rating: round(asTutor.averageRating),
        count: asTutor.totalReviews,
      },
      student: {
        rating: round(asStudent.averageRating),
        count: asStudent.totalReviews,
      },
    };
  }

  async getTopRatedUsers(role: 'TUTOR' | 'STUDENT', limit: number = 10) {
    const topUsers = await this.db.review.groupBy({
      by: ['targetId'],
      where: { targetRole: role },
      having: {
        targetId: {
          _count: { gte: 3 }, // Минимум 3 отзыва
        },
      },
      _avg: { rating: true },
      _count: { targetId: true },
      orderBy: {
        _avg: { rating: 'desc' },
      },
      take: limit,
    });

    // Получаем информацию о пользователях
    const userIds = topUsers.map((item) => item.targetId);
    const users = await this.db.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        name: true,
        telegramUsername: true,
      },
    });

    return topUsers.map((item) => {
      const user = users.find((u) => u.id === item.targetId);
      return {
        user,
        averageRating: item._avg.rating || 0,
        totalReviews: item._count.targetId,
      };
    });
  }
}

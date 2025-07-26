import { Injectable } from '@nestjs/common';
import { Review, Prisma } from '@prisma/client';
import { DatabaseService } from '../../database/database.service';
import {
  CreateReviewDto,
  UpdateReviewDto,
  ReviewFilterDto,
} from './dto/review.dto';
import {
  BaseService,
  BusinessException,
  NotFoundException,
  PaginatedResult,
  PaginationDto,
} from '@common';

@Injectable()
export class ReviewsService extends BaseService {
  constructor(private readonly db: DatabaseService) {
    super();
  }

  async create(createReviewDto: CreateReviewDto): Promise<Review> {
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
      if (
        deal.studentId !== createReviewDto.authorId &&
        deal.tutorId !== createReviewDto.authorId
      ) {
        throw new BusinessException(
          'Отзыв может оставить только участник сделки',
        );
      }

      // Проверяем, что получатель участвует в сделке
      if (
        deal.studentId !== createReviewDto.targetId &&
        deal.tutorId !== createReviewDto.targetId
      ) {
        throw new BusinessException(
          'Отзыв можно оставить только участнику сделки',
        );
      }

      // Проверяем, что автор и получатель разные люди
      if (createReviewDto.authorId === createReviewDto.targetId) {
        throw new BusinessException('Нельзя оставлять отзыв самому себе');
      }

      // Проверяем, что отзыв еще не оставлен
      const existingReview = await this.db.review.findFirst({
        where: { dealId: createReviewDto.dealId },
      });

      if (existingReview) {
        throw new BusinessException('По этой сделке уже оставлен отзыв');
      }

      // Создаем отзыв
      const review = await this.db.review.create({
        data: createReviewDto,
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

      return review;
    } catch (error) {
      if (
        error instanceof BusinessException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logError('Ошибка создания отзыва', error as Error, createReviewDto);
      throw new BusinessException('Не удалось создать отзыв');
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
        where.targetRole = filterDto.targetRole as any;
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
      throw new BusinessException('Не удалось получить список отзывов');
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

  async findByTarget(targetId: string): Promise<Review[]> {
    return this.db.review.findMany({
      where: { targetId },
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

  async update(id: string, updateReviewDto: UpdateReviewDto): Promise<Review> {
    try {
      // Проверяем существование отзыва
      const existingReview = await this.findOne(id);

      // Нельзя изменять ключевые поля после создания
      if (
        updateReviewDto.dealId ||
        updateReviewDto.authorId ||
        updateReviewDto.targetId ||
        updateReviewDto.targetRole
      ) {
        throw new BusinessException(
          'Нельзя изменять сделку, автора или получателя отзыва после создания',
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
      throw new BusinessException('Не удалось обновить отзыв');
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
      throw new BusinessException('Не удалось удалить отзыв');
    }
  }

  async getTargetStats(targetId: string) {
    const [reviews, avgRating, ratingDistribution] = await Promise.all([
      // Все отзывы
      this.db.review.findMany({
        where: { targetId },
        select: { rating: true, createdAt: true },
      }),
      // Средний рейтинг
      this.db.review.aggregate({
        where: { targetId },
        _avg: { rating: true },
      }),
      // Распределение по рейтингам
      this.db.review.groupBy({
        by: ['rating'],
        where: { targetId },
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

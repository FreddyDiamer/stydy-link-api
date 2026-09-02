import { Injectable } from '@nestjs/common';
import { User, Prisma } from '@prisma/client';
import { DatabaseService } from '../../database/database.service';
import { UpdateUserDto, UserFilterDto } from './dto/user.dto';
import {
  BaseService,
  BusinessException,
  NotFoundException,
  PaginatedResult,
  PaginationDto,
} from '@common';

/** Поля пользователя, которые можно показывать другим пользователям */
const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  telegramUsername: true,
  description: true,
  avatarUrl: true,
  groupId: true,
  group: true,
  lastActivity: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{
  select: typeof PUBLIC_USER_SELECT;
}>;

@Injectable()
export class UsersService extends BaseService {
  constructor(private readonly db: DatabaseService) {
    super();
  }

  async findAll(
    paginationDto: PaginationDto,
    filterDto: UserFilterDto,
  ): Promise<PaginatedResult<PublicUser>> {
    try {
      const where: Prisma.UserWhereInput = {};

      // Поиск по имени или username
      if (filterDto.search) {
        where.OR = [
          { name: { contains: filterDto.search, mode: 'insensitive' } },
          {
            telegramUsername: {
              contains: filterDto.search,
              mode: 'insensitive',
            },
          },
        ];
      }

      const [items, total] = await Promise.all([
        this.db.user.findMany({
          where,
          select: PUBLIC_USER_SELECT,
          skip: paginationDto.skip,
          take: paginationDto.limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.db.user.count({ where }),
      ]);

      return {
        items,
        total,
        page: paginationDto.page,
        limit: paginationDto.limit,
        totalPages: Math.ceil(total / paginationDto.limit),
      };
    } catch (error) {
      this.logError('Failed to fetch users', error as Error, {
        pagination: paginationDto,
        filter: filterDto,
      });
      throw new BusinessException('Не удалось получить список пользователей');
    }
  }

  /** Полный профиль — только для самого пользователя и внутренней логики */
  async findOne(id: string): Promise<User> {
    const user = await this.db.user.findUnique({
      where: { id },
      include: {
        group: true,
        services: {
          where: { status: 'ACTIVE' },
          include: { subject: true, teacher: true },
        },
        requests: {
          include: { subject: true, teacher: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User', id);
    }

    return user;
  }

  /** Публичный профиль для просмотра другими пользователями */
  async findPublicById(id: string) {
    const user = await this.db.user.findUnique({
      where: { id },
      select: {
        ...PUBLIC_USER_SELECT,
        services: {
          where: { status: 'ACTIVE' },
          include: { subject: true, teacher: true },
        },
        requests: {
          include: { subject: true, teacher: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User', id);
    }

    return user;
  }

  async findByTelegramId(telegramId: string): Promise<User | null> {
    return this.db.user.findUnique({
      where: { telegramId },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    try {
      // Проверяем существование пользователя
      await this.findOne(id);

      const updatedUser = await this.db.user.update({
        where: { id },
        data: {
          ...updateUserDto,
          updatedAt: new Date(),
        },
      });

      this.logInfo(`User updated: ${id}`, updateUserDto);
      return updatedUser;
    } catch (error) {
      if (
        error instanceof BusinessException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logError('Failed to update user', error as Error, {
        id,
        ...updateUserDto,
      });
      throw new BusinessException('Не удалось обновить пользователя');
    }
  }

  async updateGroup(id: string, groupId?: string): Promise<User> {
    try {
      // Проверяем существование пользователя
      await this.findOne(id);

      // Если указана группа, проверяем её существование
      if (groupId) {
        const group = await this.db.group.findUnique({
          where: { id: groupId },
        });

        if (!group) {
          throw new NotFoundException(`Group with ID ${groupId} not found`);
        }
      }

      const user = await this.db.user.update({
        where: { id },
        data: { groupId },
        include: {
          group: true,
        },
      });

      this.logInfo(`User group updated: ${id}`, { groupId });
      return user;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logError('Failed to update user group', error as Error, {
        id,
        groupId,
      });
      throw new BusinessException('Не удалось обновить группу пользователя');
    }
  }

  async getUserStats(userId: string, includeBalance = false) {
    const user = await this.findOne(userId);

    const [
      activeServices,
      openRequests,
      completedAsDealer,
      completedAsStudent,
      averageRating,
      totalReviews,
    ] = await Promise.all([
      // Активные услуги (как репетитор)
      this.db.service.count({
        where: { tutorId: userId, status: 'ACTIVE' },
      }),
      // Заявки (как студент)
      this.db.request.count({
        where: { studentId: userId },
      }),
      // Завершенные сделки как репетитор
      this.db.deal.count({
        where: { tutorId: userId, status: 'COMPLETED' },
      }),
      // Завершенные сделки как студент
      this.db.deal.count({
        where: { studentId: userId, status: 'COMPLETED' },
      }),
      // Средний рейтинг от отзывов
      this.db.review.aggregate({
        where: { targetId: userId },
        _avg: { rating: true },
      }),
      // Общее количество отзывов
      this.db.review.count({
        where: { targetId: userId },
      }),
    ]);

    return {
      // Данные как репетитора
      activeServices,
      completedAsDealer,

      // Данные как студента
      openRequests,
      completedAsStudent,

      // Общие данные
      averageRating: averageRating._avg.rating || 0,
      totalReviews,
      ...(includeBalance ? { balance: user.balance } : {}),

      // Флаги активности
      hasServices: activeServices > 0,
      hasRequests: openRequests > 0,
    };
  }
}

import { Injectable } from '@nestjs/common';
import { User, Prisma } from '@prisma/client';
import { DatabaseService } from '../../database/database.service';
import { BaseService } from '../../common/services/base.service';
import { NotFoundException, BusinessException } from '../../common';
import { CreateUserDto, UpdateUserDto, UserFilterDto } from './dto/user.dto';
import { PaginationDto, PaginatedResult } from '../../common';

@Injectable()
export class UsersService extends BaseService {
  constructor(private readonly db: DatabaseService) {
    super();
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    try {
      // Проверяем уникальность telegramId и telegramUsername
      const existingUser = await this.db.user.findFirst({
        where: {
          OR: [
            { telegramId: createUserDto.telegramId },
            { telegramUsername: createUserDto.telegramUsername },
          ],
        },
      });

      if (existingUser) {
        if (existingUser.telegramId === createUserDto.telegramId) {
          throw new BusinessException(
            `User with telegramId ${createUserDto.telegramId} already exists`,
          );
        }
        throw new BusinessException(
          `User with telegramUsername ${createUserDto.telegramUsername} already exists`,
        );
      }

      const user = await this.db.user.create({
        data: createUserDto,
      });

      this.logInfo(`User created: ${user.id}`, { telegramId: user.telegramId });
      return user;
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      this.logError('Failed to create user', error as Error, createUserDto);
      throw new BusinessException('Failed to create user');
    }
  }

  async findAll(
    paginationDto: PaginationDto,
    filterDto: UserFilterDto,
  ): Promise<PaginatedResult<User>> {
    try {
      const where: Prisma.UserWhereInput = {};

      // Фильтры
      if (filterDto.isActive !== undefined) {
        where.isActive = filterDto.isActive;
      }

      if (filterDto.isVerified !== undefined) {
        where.isVerified = filterDto.isVerified;
      }

      if (filterDto.minRating !== undefined) {
        where.rating = { gte: filterDto.minRating };
      }

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
      throw new BusinessException('Failed to fetch users');
    }
  }

  async findOne(id: string): Promise<User> {
    const user = await this.db.user.findUnique({
      where: { id },
      include: {
        services: {
          where: { status: 'ACTIVE' },
          include: { subject: true, teacher: true },
        },
        requests: {
          where: { status: 'OPEN' },
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

      // Проверяем уникальность при обновлении
      if (updateUserDto.telegramId || updateUserDto.telegramUsername) {
        const existingUser = await this.db.user.findFirst({
          where: {
            id: { not: id },
            OR: [
              ...(updateUserDto.telegramId
                ? [{ telegramId: updateUserDto.telegramId }]
                : []),
              ...(updateUserDto.telegramUsername
                ? [{ telegramUsername: updateUserDto.telegramUsername }]
                : []),
            ],
          },
        });

        if (existingUser) {
          throw new BusinessException(
            'User with this telegram ID or username already exists',
          );
        }
      }

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
      throw new BusinessException('Failed to update user');
    }
  }

  async deactivate(id: string): Promise<User> {
    return this.update(id, { isActive: false });
  }

  async activate(id: string): Promise<User> {
    return this.update(id, { isActive: true });
  }

  async verify(id: string): Promise<User> {
    return this.update(id, { isVerified: true });
  }

  async unverify(id: string): Promise<User> {
    return this.update(id, { isVerified: false });
  }

  async remove(id: string): Promise<void> {
    try {
      await this.findOne(id);

      await this.db.user.delete({
        where: { id },
      });

      this.logInfo(`User deleted: ${id}`);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logError('Failed to delete user', error as Error, { id });
      throw new BusinessException('Failed to delete user');
    }
  }

  async getUserStats(userId: string) {
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
      // Открытые заявки (как студент)
      this.db.request.count({
        where: { studentId: userId, status: 'OPEN' },
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
      balance: user.balance,

      // Флаги активности
      hasServices: activeServices > 0,
      hasRequests: openRequests > 0,
    };
  }
}

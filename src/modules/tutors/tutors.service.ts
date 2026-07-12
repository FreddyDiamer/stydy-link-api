import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { UsersService } from '../users/users.service';
import { ReviewsService } from '../reviews/reviews.service';
import { BaseService } from '@common';

export interface TutorStatsDto {
  totalStudents: number;
  totalReviews: number;
  averageRating: number;
  activeServices: number;
  monthlyRequests: number;
}

@Injectable()
export class TutorsService extends BaseService {
  constructor(
    private readonly db: DatabaseService,
    private readonly usersService: UsersService,
    private readonly reviewsService: ReviewsService,
  ) {
    super();
  }

  async getTutorStats(userId: string): Promise<TutorStatsDto> {
    const userStats = await this.usersService.getUserStats(userId);

    const since = new Date();
    since.setDate(since.getDate() - 30);
    const monthlyRequests = await this.db.serviceResponse.count({
      where: {
        service: { tutorId: userId },
        createdAt: { gte: since },
      },
    });

    const activeDealsStudentCount = await this.db.deal.groupBy({
      by: ['studentId'],
      where: {
        tutorId: userId,
        status: { in: ['PENDING', 'ACCEPTED', 'IN_PROGRESS'] },
      },
      _count: { studentId: true },
    });

    return {
      totalStudents: activeDealsStudentCount.length,
      totalReviews: userStats.totalReviews,
      averageRating: userStats.averageRating || 0,
      activeServices: userStats.activeServices,
      monthlyRequests,
    };
  }

  async getTutorById(id: string) {
    const user = await this.usersService.findOne(id);
    const stats = await this.reviewsService.getTargetStats(id);

    const services =
      (user as { services?: Array<{ subject?: { id: string; name: string } }> })
        .services || [];
    const subjects = Array.from(
      new Map(
        services
          .filter((s) => s.subject)
          .map((s) => [s.subject!.id, s.subject!]),
      ).values(),
    );

    return {
      ...user,
      rating: stats.averageRating || 0,
      reviewsCount: stats.totalReviews || 0,
      subjects,
      isFavorite: false,
    };
  }
}

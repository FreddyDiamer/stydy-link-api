import { Module } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { DatabaseModule } from '../../database/database.module';

/**
 * Домен Reviews - система отзывов и рейтингов
 *
 * Обеспечивает функциональность:
 * - Создание отзывов по завершенным сделкам
 * - Рейтинговая система (1-5 звезд)
 * - Статистика и аналитика отзывов
 * - Топ пользователей по рейтингу
 * - Фильтрация и поиск отзывов
 *
 * Использует связи с Deal и User из других доменов.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}

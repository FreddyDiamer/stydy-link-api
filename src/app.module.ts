import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { EducationModule } from './modules/education/education.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { TutorsModule } from './modules/tutors/tutors.module';
import { ParserModule } from './modules/parser/parser.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import {
  JwtAuthGuard,
  TransformInterceptor,
  requestIdMiddleware,
} from '@common';
import { appConfig, databaseConfig, jwtConfig } from './config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig],
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    UsersModule,
    EducationModule,
    MarketplaceModule,
    ReviewsModule,
    NotificationsModule,
    TutorsModule,
    ParserModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  /** X-Request-Id на каждый запрос — и в проде, и в e2e (оба собирают AppModule) */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(requestIdMiddleware).forRoutes('*');
  }
}

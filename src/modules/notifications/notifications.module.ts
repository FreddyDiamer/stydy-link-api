import { Global, Module } from '@nestjs/common';
import { TelegramBotService } from './telegram-bot.service';
import { NotificationService } from './notification.service';

@Global()
@Module({
  providers: [TelegramBotService, NotificationService],
  exports: [NotificationService],
})
export class NotificationsModule {}

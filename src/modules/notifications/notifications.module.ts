import { Global, Module } from '@nestjs/common';
import { TelegramBotService } from './telegram-bot.service';
import { NotificationService } from './notification.service';
import { TelegramWebhookController } from './telegram-webhook.controller';

@Global()
@Module({
  controllers: [TelegramWebhookController],
  providers: [TelegramBotService, NotificationService],
  exports: [NotificationService],
})
export class NotificationsModule {}

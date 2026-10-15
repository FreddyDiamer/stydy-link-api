import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const appConfigSchema = z.object({
  port: z.number().int().positive().default(3000),
  nodeEnv: z.enum(['development', 'production', 'test']).default('production'),
  telegramBotToken: z.string().optional(),
  frontendBaseUrl: z.string().url().optional(),
  adminTelegramIds: z.array(z.string()).default([]),
});

export const appConfig = registerAs('app', () => {
  const config = {
    port: parseInt(process.env.PORT ?? '3000', 10),
    nodeEnv: process.env.NODE_ENV as 'development' | 'production' | 'test',
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    frontendBaseUrl: process.env.FRONTEND_BASE_URL,
    // Telegram ID администраторов через запятую; пусто — админов нет
    adminTelegramIds: (process.env.ADMIN_TELEGRAM_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  };

  const validatedConfig = appConfigSchema.parse(config);

  if (
    validatedConfig.nodeEnv === 'production' &&
    !validatedConfig.telegramBotToken
  ) {
    throw new Error('TELEGRAM_BOT_TOKEN is required in production');
  }

  return validatedConfig;
});

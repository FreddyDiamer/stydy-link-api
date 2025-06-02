import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const appConfigSchema = z.object({
  port: z.number().int().positive().default(3000),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  telegramBotToken: z.string().optional(),
});

export const appConfig = registerAs('app', () => {
  const config = {
    port: parseInt(process.env.PORT ?? '3000', 10),
    nodeEnv: process.env.NODE_ENV as 'development' | 'production' | 'test',
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
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

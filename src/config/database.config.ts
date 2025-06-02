import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const databaseConfigSchema = z.object({
  url: z.string().url('DATABASE_URL must be a valid URL'),
});

export const databaseConfig = registerAs('database', () => {
  const config = {
    url: process.env.DATABASE_URL,
  };

  const validatedConfig = databaseConfigSchema.parse(config);

  return validatedConfig;
});

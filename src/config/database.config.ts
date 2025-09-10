import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const databaseConfigSchema = z.object({
  url: z.string().url('DATABASE_URL must be a valid URL'),
});

export const databaseConfig = registerAs('database', () => {
  const databaseUrl =
    process.env.DATABASE_URL ||
    `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'password'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'kai_repetitor'}`;

  const config = {
    url: databaseUrl,
  };

  const validatedConfig = databaseConfigSchema.parse(config);

  return validatedConfig;
});

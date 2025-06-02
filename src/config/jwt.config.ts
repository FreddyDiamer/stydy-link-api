import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const jwtConfigSchema = z.object({
  secret: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  expiresIn: z.string().default('7d'),
});

export const jwtConfig = registerAs('jwt', () => {
  const config = {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  };

  const validatedConfig = jwtConfigSchema.parse(config);

  return validatedConfig;
});

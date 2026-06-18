import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  allows_write_to_pm?: boolean;
  photo_url?: string;
}

export interface TelegramInitData {
  query_id?: string;
  user: TelegramUser;
  receiver?: TelegramUser;
  chat?: {
    id: number;
    type: string;
    title?: string;
    username?: string;
    photo_url?: string;
  };
  chat_type?: string;
  chat_instance?: string;
  start_param?: string;
  can_send_after?: number;
  auth_date: number;
  hash: string;
}

export class TelegramAuthDto {
  @ApiProperty({
    description: 'Telegram WebApp initData строка',
    example:
      'query_id=AAGpdtYyAAAAAKl21jLf3CLz&user=%7B%22id%22%3A852915881%2C%22first_name%22%3A%22Freddy%22%2C%22last_name%22%3A%22%22%2C%22username%22%3A%22FreddyDiamer%22%2C%22language_code%22%3A%22en%22%7D&auth_date=1749294661&hash=3e25de3481f5da2e4c436d40b8bb0c0aa19be9ce8c63094accc267f70afccfab',
  })
  @IsString()
  @IsNotEmpty()
  initData: string;
}

export class DevLoginDto {
  @ApiPropertyOptional({
    description:
      'ID существующего пользователя для входа. Если указан — вход выполняется под этим пользователем (остальные поля игнорируются).',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({
    description:
      'Telegram ID. Пользователь создаётся/находится по этому ID. По умолчанию используется тестовый dev-пользователь.',
    example: '852915881',
  })
  @IsString()
  @IsOptional()
  telegramId?: string;

  @ApiPropertyOptional({
    description: 'Telegram username для создаваемого dev-пользователя',
    example: 'dev_user',
  })
  @IsString()
  @IsOptional()
  telegramUsername?: string;

  @ApiPropertyOptional({
    description: 'Имя для создаваемого dev-пользователя',
    example: 'Dev User',
  })
  @IsString()
  @IsOptional()
  name?: string;
}

export class AuthResponseDto {
  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'User information',
  })
  user: {
    id: string;
    telegramUsername: string;
    name: string;
  };
}

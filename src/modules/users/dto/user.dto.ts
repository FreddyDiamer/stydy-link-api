import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@common';

/**
 * Поля, которые пользователь может менять у себя сам.
 * Служебные поля (telegramId, rating, balance, isVerified, isActive)
 * управляются только бизнес-логикой и недоступны через API.
 */
export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'User full name',
    example: 'Иван Иванов',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({
    description: 'User group ID',
    example: 'uuid-here',
  })
  @IsOptional()
  @IsString()
  groupId?: string;

  @ApiPropertyOptional({
    description: 'Enable Telegram notifications',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  telegramNotificationsEnabled?: boolean;

  @ApiPropertyOptional({
    description:
      'Per-type notification preferences (e.g. onResponse, onDeal, onReview)',
    example: { onResponse: true, onDeal: true, onReview: true },
  })
  @IsOptional()
  notificationPreferences?: Record<string, boolean>;
}

/** Пагинация внутри фильтра: два @Query() на одном методе не проходят forbidNonWhitelisted */
export class UserFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by active status',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      return value === 'true';
    }
    return value as boolean | undefined;
  })
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by verified status',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      return value === 'true';
    }
    return value as boolean | undefined;
  })
  isVerified?: boolean;

  @ApiPropertyOptional({
    description: 'Search by name or telegram username',
    example: 'Иван',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Minimum rating',
    minimum: 0,
    maximum: 5,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value != null && value !== '' ? Number(value) : undefined,
  )
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;
}

/** Публичный профиль пользователя (без telegramId, balance и настроек нотификаций) */
export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  telegramUsername: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  avatarUrl?: string;

  @ApiPropertyOptional()
  groupId?: string;

  @ApiPropertyOptional()
  group?: {
    id: string;
    number: string;
  };

  @ApiProperty()
  lastActivity: Date;

  @ApiProperty()
  createdAt: Date;
}

export class UpdateGroupDto {
  @ApiProperty({
    description: 'Group ID',
    example: 'uuid-here',
  })
  @IsString()
  @IsNotEmpty()
  groupId: string;
}

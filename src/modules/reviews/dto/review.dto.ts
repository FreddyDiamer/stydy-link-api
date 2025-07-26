import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsUUID,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class CreateReviewDto {
  @ApiProperty({
    description: 'ID сделки, по которой оставляется отзыв',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  dealId: string;

  @ApiProperty({
    description: 'ID автора отзыва',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  authorId: string;

  @ApiProperty({
    description: 'ID получателя отзыва',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  targetId: string;

  @ApiProperty({
    description: 'Роль получателя отзыва',
    enum: ['TUTOR', 'STUDENT'],
    example: 'TUTOR',
  })
  @IsEnum(UserRole)
  targetRole: UserRole;

  @ApiProperty({
    description: 'Рейтинг от 1 до 5',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @IsNumber()
  @Min(1, { message: 'Минимальный рейтинг 1' })
  @Max(5, { message: 'Максимальный рейтинг 5' })
  rating: number;

  @ApiPropertyOptional({
    description: 'Текст отзыва',
    example:
      'Отличный репетитор! Все объяснил понятно, помог подготовиться к экзамену.',
  })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class UpdateReviewDto extends PartialType(CreateReviewDto) {}

export class ReviewFilterDto {
  @ApiPropertyOptional({
    description: 'Фильтр по ID автора отзыва',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  authorId?: string;

  @ApiPropertyOptional({
    description: 'Фильтр по ID получателя отзыва',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  targetId?: string;

  @ApiPropertyOptional({
    description: 'Фильтр по роли получателя',
    enum: ['TUTOR', 'STUDENT'],
    example: 'TUTOR',
  })
  @IsOptional()
  @IsEnum(UserRole)
  targetRole?: UserRole;

  @ApiPropertyOptional({
    description: 'Минимальный рейтинг',
    example: 4,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional({
    description: 'Максимальный рейтинг',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  maxRating?: number;

  @ApiPropertyOptional({
    description: 'Поиск в тексте отзыва',
    example: 'отличный',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class ReviewResponseDto {
  @ApiProperty({
    description: 'Уникальный идентификатор отзыва',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d482',
  })
  id: string;

  @ApiProperty({
    description: 'ID сделки',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  dealId: string;

  @ApiProperty({
    description: 'ID автора отзыва',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
  })
  authorId: string;

  @ApiProperty({
    description: 'ID получателя отзыва',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
  })
  targetId: string;

  @ApiProperty({
    description: 'Роль получателя отзыва',
    enum: ['TUTOR', 'STUDENT'],
    example: 'TUTOR',
  })
  targetRole: UserRole;

  @ApiProperty({
    description: 'Рейтинг от 1 до 5',
    example: 5,
  })
  rating: number;

  @ApiPropertyOptional({
    description: 'Текст отзыва',
    example:
      'Отличный репетитор! Все объяснил понятно, помог подготовиться к экзамену.',
  })
  comment?: string;

  @ApiProperty({
    description: 'Дата создания отзыва',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Дата последнего обновления',
    example: '2024-01-15T10:30:00.000Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Информация об авторе отзыва',
  })
  author?: {
    id: string;
    name: string;
    telegramUsername: string;
  };

  @ApiPropertyOptional({
    description: 'Информация о получателе отзыва',
  })
  target?: {
    id: string;
    name: string;
    telegramUsername: string;
  };

  @ApiPropertyOptional({
    description: 'Информация о сделке',
  })
  deal?: {
    id: string;
    price: number;
    status: string;
    subject: {
      name: string;
    };
    teacher: {
      fullName: string;
    };
  };
}

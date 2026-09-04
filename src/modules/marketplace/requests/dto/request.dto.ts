import {
  IsEnum,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsUUID,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateRequestDto {
  @ApiProperty({
    description: 'ID студента, создающего заявку',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  studentId: string;

  @ApiProperty({
    description: 'ID предмета',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  subjectId: string;

  @ApiProperty({
    description: 'ID преподавателя',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  teacherId: string;

  @ApiPropertyOptional({
    description: 'Описание заявки',
    example: 'Нужна помощь с подготовкой к экзамену по высшей математике',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Максимальный бюджет в копейках',
    example: 200000,
    minimum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(100, { message: 'Минимальный бюджет 1 рубль (100 копеек)' })
  @Max(10000000, { message: 'Максимальный бюджет 100,000 рублей' })
  budget?: number;

  @ApiPropertyOptional({
    description: 'Желаемый срок выполнения',
    example: '2024-06-01T10:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  deadline?: string;
}

export class UpdateRequestDto extends PartialType(CreateRequestDto) {}

export class RequestFilterDto {
  @ApiPropertyOptional({
    description: 'Статус заявки; по умолчанию лента показывает только OPEN',
    enum: ['OPEN', 'MATCHED', 'CLOSED'],
  })
  @IsOptional()
  @IsEnum(['OPEN', 'MATCHED', 'CLOSED'])
  status?: 'OPEN' | 'MATCHED' | 'CLOSED';

  @ApiPropertyOptional({
    description: 'Фильтр по ID студента',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional({
    description: 'Фильтр по ID предмета',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional({
    description: 'Фильтр по ID преподавателя',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  teacherId?: string;

  @ApiPropertyOptional({
    description: 'Минимальный бюджет в копейках',
    example: 50000,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minBudget?: number;

  @ApiPropertyOptional({
    description: 'Максимальный бюджет в копейках',
    example: 500000,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxBudget?: number;

  @ApiPropertyOptional({
    description: 'Поиск в описании заявки',
    example: 'экзамен',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class RequestResponseDto {
  @ApiProperty({
    description: 'Уникальный идентификатор заявки',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d482',
  })
  id: string;

  @ApiProperty({
    description: 'ID студента',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  studentId: string;

  @ApiProperty({
    description: 'ID предмета',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
  })
  subjectId: string;

  @ApiProperty({
    description: 'ID преподавателя',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
  })
  teacherId: string;

  @ApiPropertyOptional({
    description: 'Описание заявки',
    example: 'Нужна помощь с подготовкой к экзамену по высшей математике',
  })
  description?: string;

  @ApiPropertyOptional({
    description: 'Максимальный бюджет в копейках',
    example: 200000,
  })
  budget?: number;

  @ApiPropertyOptional({
    description: 'Желаемый срок выполнения',
    example: '2024-06-01T10:00:00.000Z',
  })
  deadline?: Date;

  @ApiProperty({
    description: 'Дата создания заявки',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Дата последнего обновления',
    example: '2024-01-15T10:30:00.000Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Информация о студенте',
  })
  student?: {
    id: string;
    name: string;
    telegramUsername: string;
  };

  @ApiPropertyOptional({
    description: 'Информация о предмете',
  })
  subject?: {
    id: string;
    name: string;
    isActive: boolean;
  };

  @ApiPropertyOptional({
    description: 'Информация о преподавателе',
  })
  teacher?: {
    id: string;
    fullName: string;
  };

  @ApiPropertyOptional({
    description: 'Статистика откликов на заявку',
  })
  _count?: {
    responses: number;
  };
}

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsUUID,
  IsEnum,
  Min,
  Max,
  IsInt,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ServiceStatus } from '@prisma/client';

export class CreateServiceDto {
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

  @ApiProperty({
    description: 'Цена услуги в копейках',
    example: 150000,
    minimum: 100,
  })
  @IsNumber()
  @Min(100, { message: 'Минимальная цена 1 рубль (100 копеек)' })
  @Max(10000000, { message: 'Максимальная цена 100,000 рублей' })
  price: number;

  @ApiPropertyOptional({
    description: 'Описание услуги',
    example: 'Подготовка к ЕГЭ по математике профильного уровня',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Количество занятий для подготовки студента',
    example: 10,
    minimum: 1,
    maximum: 200,
  })
  @IsInt()
  @Min(1, { message: 'Минимум 1 занятие' })
  @Max(200, { message: 'Максимум 200 занятий' })
  lessonsCount: number;

  @ApiProperty({
    description: 'Длительность одного занятия в минутах',
    example: 60,
    minimum: 15,
    maximum: 180,
  })
  @IsInt()
  @Min(15, { message: 'Минимум 15 минут' })
  @Max(180, { message: 'Максимум 180 минут' })
  lessonDurationMinutes: number;

  @ApiPropertyOptional({
    description: 'Статус услуги',
    enum: ServiceStatus,
    example: ServiceStatus.ACTIVE,
    default: ServiceStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ServiceStatus)
  status?: ServiceStatus;
}

export class UpdateServiceDto extends PartialType(CreateServiceDto) {}

export class ServiceFilterDto {
  @ApiPropertyOptional({
    description: 'Фильтр по ID репетитора',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  tutorId?: string;

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
    description: 'Фильтр по статусу услуги',
    enum: ServiceStatus,
    example: ServiceStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ServiceStatus)
  status?: ServiceStatus;

  @ApiPropertyOptional({
    description: 'Минимальная цена в копейках',
    example: 50000,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({
    description: 'Максимальная цена в копейках',
    example: 500000,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    description: 'Поиск в описании услуги',
    example: 'ЕГЭ',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class ServiceQueryDto extends ServiceFilterDto {
  @ApiPropertyOptional({
    description: 'Page number',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  get skip(): number {
    return ((this.page || 1) - 1) * (this.limit || 10);
  }
}

export class ServiceResponseDto {
  @ApiProperty({
    description: 'Уникальный идентификатор услуги',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d482',
  })
  id: string;

  @ApiProperty({
    description: 'ID репетитора',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  tutorId: string;

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

  @ApiProperty({
    description: 'Цена услуги в копейках',
    example: 150000,
  })
  price: number;

  @ApiPropertyOptional({
    description: 'Описание услуги',
    example: 'Подготовка к ЕГЭ по математике профильного уровня',
  })
  description?: string;

  @ApiProperty({
    description: 'Статус услуги',
    enum: ServiceStatus,
    example: ServiceStatus.ACTIVE,
  })
  status: ServiceStatus;

  @ApiProperty({
    description: 'Количество занятий для подготовки студента',
    example: 10,
  })
  lessonsCount: number;

  @ApiProperty({
    description: 'Длительность одного занятия в минутах',
    example: 60,
  })
  lessonDurationMinutes: number;

  @ApiProperty({
    description: 'Дата создания услуги',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Дата последнего обновления',
    example: '2024-01-15T10:30:00.000Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Информация о репетиторе',
  })
  tutor?: {
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
    description: 'Статистика откликов на услугу',
  })
  _count?: {
    responses: number;
  };
}

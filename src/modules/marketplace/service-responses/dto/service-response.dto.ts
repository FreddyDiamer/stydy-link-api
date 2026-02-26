import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsUUID,
  IsEnum,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
// Вместо enum ResponseStatus используем string union type
export type ResponseStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

export class CreateServiceResponseDto {
  @ApiProperty({
    description: 'ID студента, откликающегося на услугу',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  studentId!: string;

  @ApiProperty({
    description: 'ID услуги, на которую откликается студент',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  serviceId!: string;

  @ApiPropertyOptional({
    description: 'Сообщение студента при отклике',
    example: 'Здравствуйте! Меня интересует подготовка к ЕГЭ по математике.',
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({
    description: 'Предложенная студентом цена в копейках',
    example: 140000,
    minimum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(100, { message: 'Минимальная цена 1 рубль (100 копеек)' })
  @Max(10000000, { message: 'Максимальная цена 100,000 рублей' })
  price?: number;

  @ApiPropertyOptional({
    description: 'Предложенная дата выполнения',
    example: '2024-06-01T10:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  proposedDeadline?: string;

  @ApiPropertyOptional({
    description:
      'Тип дедлайна, выбранный студентом (today/week/month/custom). Нужен, чтобы репетитор видел протяженность (например, "в течение месяца").',
    example: 'month',
  })
  @IsOptional()
  @IsString()
  proposedDeadlineType?: string;

  @ApiPropertyOptional({
    description:
      'Тип бюджета/ценового ожидания (service-price/flexible/lower/higher). Нужен, чтобы репетитор видел, как студент относится к цене.',
    example: 'lower',
  })
  @IsOptional()
  @IsString()
  budgetType?: string;
}

export class UpdateServiceResponseDto extends PartialType(
  CreateServiceResponseDto,
) {
  @ApiPropertyOptional({
    description: 'Статус отклика',
    enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'],
    example: 'PENDING',
  })
  @IsOptional()
  @IsEnum(['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'])
  status?: ResponseStatus;
}

export class ServiceResponseFilterDto {
  @ApiPropertyOptional({
    description: 'Фильтр по ID студента',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional({
    description: 'Фильтр по ID услуги',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional({
    description: 'Фильтр по статусу отклика',
    enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'],
    example: 'PENDING',
  })
  @IsOptional()
  @IsEnum(['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'])
  status?: ResponseStatus;

  @ApiPropertyOptional({
    description: 'Минимальная предложенная цена в копейках',
    example: 50000,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({
    description: 'Максимальная предложенная цена в копейках',
    example: 500000,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    description: 'Поиск в тексте сообщения',
    example: 'ЕГЭ',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class ServiceResponseResponseDto {
  @ApiProperty({
    description: 'Уникальный идентификатор отклика',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d482',
  })
  id: string;

  @ApiProperty({
    description: 'ID студента',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  studentId: string;

  @ApiProperty({
    description: 'ID услуги',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
  })
  serviceId: string;

  @ApiPropertyOptional({
    description: 'Сообщение студента',
    example: 'Здравствуйте! Меня интересует подготовка к ЕГЭ по математике.',
  })
  message?: string;

  @ApiPropertyOptional({
    description: 'Предложенная цена в копейках',
    example: 140000,
  })
  price?: number;

  @ApiProperty({
    description: 'Статус отклика',
    enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'],
    example: 'PENDING',
  })
  status: ResponseStatus;

  @ApiPropertyOptional({
    description: 'Предложенная дата выполнения',
    example: '2024-06-01T10:00:00.000Z',
  })
  proposedDeadline?: Date;

  @ApiPropertyOptional({
    description:
      'Тип дедлайна, выбранный студентом (today/week/month/custom). Используется для показа протяженности вроде "в течение месяца".',
    example: 'month',
  })
  proposedDeadlineType?: string;

  @ApiPropertyOptional({
    description:
      'Тип бюджета/ценового ожидания (service-price/flexible/lower/higher).',
    example: 'lower',
  })
  budgetType?: string;

  @ApiProperty({
    description: 'Дата создания отклика',
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
    description: 'Информация об услуге',
  })
  service?: {
    id: string;
    price: number;
    description?: string;
    tutor: {
      id: string;
      name: string;
      telegramUsername: string;
    };
    subject: {
      id: string;
      name: string;
    };
    teacher: {
      id: string;
      fullName: string;
    };
  };

  @ApiPropertyOptional({
    description: 'Сделка, созданная из этого отклика',
  })
  deal?: {
    id: string;
    status: string;
    price: number;
  };
}

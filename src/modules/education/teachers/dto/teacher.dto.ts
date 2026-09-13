import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PaginationDto } from '@common';

export class CreateTeacherDto {
  @ApiProperty({
    description: 'Полное имя преподавателя',
    example: 'Иванов Иван Иванович',
  })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({
    description: 'Внешний идентификатор преподавателя в системе университета',
    example: 'TEACHER_001',
  })
  @IsString()
  @IsNotEmpty()
  foreignId: string;
}

export class UpdateTeacherDto extends PartialType(CreateTeacherDto) {}

/** Пагинация внутри фильтра: два @Query() на одном методе не проходят forbidNonWhitelisted */
export class TeacherFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Поиск по имени преподавателя',
    example: 'Иванов',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Поиск по внешнему ID',
    example: 'TEACHER_001',
  })
  @IsOptional()
  @IsString()
  foreignId?: string;
}

export class TeacherResponseDto {
  @ApiProperty({
    description: 'Уникальный идентификатор преподавателя',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  id: string;

  @ApiProperty({
    description: 'Полное имя преподавателя',
    example: 'Иванов Иван Иванович',
  })
  fullName: string;

  @ApiProperty({
    description: 'Внешний идентификатор в системе университета',
    example: 'TEACHER_001',
  })
  foreignId: string;

  @ApiProperty({
    description: 'Дата создания записи',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Дата последнего обновления',
    example: '2024-01-15T10:30:00Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Предметы, которые ведет преподаватель',
    isArray: true,
  })
  teacherSubjects?: any[];

  @ApiPropertyOptional({
    description: 'Статистика активности преподавателя',
  })
  _count?: {
    services: number;
    requests: number;
    deals: number;
  };
}

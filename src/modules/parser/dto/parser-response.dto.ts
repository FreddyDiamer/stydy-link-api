import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsArray, IsDate, IsEnum } from 'class-validator';

/**
 * Статусы парсинга
 */
export enum ParseStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * DTO для результата парсинга
 */
export class ParseResultDto {
  @ApiProperty({
    description: 'Время начала парсинга',
    example: '2024-01-15T10:30:00.000Z',
  })
  @IsDate()
  startTime: Date;

  @ApiProperty({
    description: 'Время окончания парсинга',
    example: '2024-01-15T10:35:00.000Z',
    required: false,
  })
  @IsDate()
  endTime?: Date;

  @ApiProperty({
    description: 'Затраченное время',
    example: 5000,
  })
  @IsNumber()
  duration: number;

  @ApiProperty({
    description: 'Статус парсинга',
    example: 'completed',
    enum: ParseStatus,
  })
  @IsEnum(ParseStatus)
  status: ParseStatus;

  @ApiProperty({
    description: 'Количество обработанных преподавателей',
    example: 150,
  })
  @IsNumber()
  teachersProcessed: number;

  @ApiProperty({
    description: 'Количество обработанных групп',
    example: 45,
  })
  @IsNumber()
  groupsProcessed: number;

  @ApiProperty({
    description: 'Количество уникальных предметов в расписаниях групп',
    example: 25,
  })
  @IsNumber()
  subjectsProcessed: number;

  @ApiProperty({
    description:
      'Количество найденных пар группа–предмет–преподаватель (связей из расписаний)',
    example: 120,
  })
  @IsNumber()
  relationsProcessed: number;

  @ApiProperty({
    description: 'Количество ошибок',
    example: 0,
  })
  @IsNumber()
  errorCount: number;

  @ApiProperty({
    description: 'Список ошибок',
    example: [],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  errors: string[];
}

/**
 * DTO для статистики синхронизации
 */
export class SyncStatsDto {
  @ApiProperty({
    description: 'Количество преподавателей в БД',
    example: 150,
  })
  @IsNumber()
  teachers: number;

  @ApiProperty({
    description: 'Количество групп в БД',
    example: 45,
  })
  @IsNumber()
  groups: number;

  @ApiProperty({
    description: 'Количество предметов в БД',
    example: 25,
  })
  @IsNumber()
  subjects: number;

  @ApiProperty({
    description: 'Количество связей преподаватель-предмет',
    example: 300,
  })
  @IsNumber()
  teacherSubjectRelations: number;

  @ApiProperty({
    description: 'Количество связей группа-предмет',
    example: 200,
  })
  @IsNumber()
  groupSubjectRelations: number;

  @ApiProperty({
    description: 'Время последнего обновления',
    example: '2024-01-15T10:35:00.000Z',
  })
  @IsDate()
  lastUpdated: Date;
}

/**
 * DTO для статуса синхронизации
 */
export class SyncStatusDto {
  @ApiProperty({
    description: 'Время последней синхронизации',
    example: '2024-01-15T10:35:00.000Z',
    required: false,
  })
  @IsDate()
  lastSyncTime?: Date;

  @ApiProperty({
    description: 'Статус синхронизации',
    example: 'completed',
    enum: ['completed', 'never_synced'],
  })
  @IsString()
  status: 'completed' | 'never_synced';
}

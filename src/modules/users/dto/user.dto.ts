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
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    description: 'Telegram user ID',
    example: '123456789',
  })
  @IsString()
  @IsNotEmpty()
  telegramId: string;

  @ApiProperty({
    description: 'Telegram username',
    example: 'john_doe',
  })
  @IsString()
  @IsNotEmpty()
  telegramUsername: string;

  @ApiProperty({
    description: 'User full name',
    example: 'Иван Иванов',
  })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({
    description: 'User verification status',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @ApiPropertyOptional({
    description: 'User active status',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'User rating',
    minimum: 0,
    maximum: 5,
    example: 4.5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({
    description: 'User balance in kopecks',
    minimum: 0,
    example: 10000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  balance?: number;

  @ApiPropertyOptional({
    description: 'User group ID',
    example: 'uuid-here',
  })
  @IsOptional()
  @IsString()
  groupId?: string;
}

export class UserFilterDto {
  @ApiPropertyOptional({
    description: 'Filter by active status',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value === 'true';
    }
    return value;
  })
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by verified status',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value === 'true';
    }
    return value;
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
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;
}

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  telegramUsername: string;

  @ApiProperty()
  telegramId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  rating: number;

  @ApiProperty()
  balance: number;

  @ApiProperty()
  isVerified: boolean;

  @ApiProperty()
  isActive: boolean;

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

  @ApiProperty()
  updatedAt: Date;
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

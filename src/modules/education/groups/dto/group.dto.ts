import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { JsonObject } from '@prisma/client/runtime/library';

export class CreateGroupDto {
  @ApiProperty({
    description: 'Внешний ID группы',
    example: 'external_group_123',
  })
  @IsString()
  @IsNotEmpty()
  foreignId: string;

  @ApiProperty({
    description: 'Номер группы',
    example: '4212',
  })
  @IsString()
  @IsNotEmpty()
  number: string;

  @ApiProperty({
    description: 'Форма обучения',
    example: {
      educationForm: 'очная',
    },
    required: false,
  })
  @IsOptional()
  @IsObject()
  data: JsonObject;
}

export class GroupResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  foreignId: string;

  @ApiProperty()
  number: string;

  @ApiProperty()
  data: JsonObject;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

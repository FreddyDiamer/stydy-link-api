import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
    example: 'очная',
  })
  @IsString()
  @IsNotEmpty()
  educationForm: string;
}

export class GroupResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  foreignId: string;

  @ApiProperty()
  number: string;

  @ApiProperty()
  educationForm: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import { GroupResponseDto } from './dto/group.dto';
import { ApiSuccessResponse } from '@common';

/**
 * Справочник групп только для чтения: данные наполняет парсер
 * университетского API, ручное редактирование через публичный API закрыто.
 */
@ApiTags('Education - Groups')
@Controller('education/groups')
@ApiBearerAuth()
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  @ApiOperation({ summary: 'Получить список всех групп' })
  @ApiSuccessResponse(GroupResponseDto)
  findAll() {
    return this.groupsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить группу по ID' })
  @ApiSuccessResponse(GroupResponseDto)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.groupsService.findOne(id);
  }
}

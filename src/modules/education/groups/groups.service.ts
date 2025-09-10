import { Injectable } from '@nestjs/common';
import { Group } from '@prisma/client';
import { DatabaseService } from '../../../database/database.service';
import { CreateGroupDto } from './dto/group.dto';
import { BaseService, BusinessException, NotFoundException } from '@common';

@Injectable()
export class GroupsService extends BaseService {
  constructor(private readonly db: DatabaseService) {
    super();
  }

  async create(createGroupDto: CreateGroupDto): Promise<Group> {
    try {
      // Проверяем уникальность номера группы и foreignId
      const existingGroup = await this.db.group.findFirst({
        where: {
          OR: [
            { number: createGroupDto.number },
            { foreignId: createGroupDto.foreignId },
          ],
        },
      });

      if (existingGroup) {
        if (existingGroup.number === createGroupDto.number) {
          throw new BusinessException(
            `Group with number ${createGroupDto.number} already exists`,
          );
        }
        throw new BusinessException(
          `Group with foreignId ${createGroupDto.foreignId} already exists`,
        );
      }

      const group = await this.db.group.create({
        data: createGroupDto,
      });

      this.logInfo(`Group created: ${group.id}`, { number: group.number });
      return group;
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      this.logError('Failed to create group', error as Error, createGroupDto);
      throw new BusinessException('Failed to create group');
    }
  }

  async findAll(): Promise<Group[]> {
    try {
      const groups = await this.db.group.findMany({
        orderBy: { number: 'asc' },
      });

      return groups;
    } catch (error) {
      this.logError('Failed to fetch groups', error as Error);
      throw new BusinessException('Failed to fetch groups');
    }
  }

  async findOne(id: string): Promise<Group> {
    const group = await this.db.group.findUnique({
      where: { id },
    });

    if (!group) {
      throw new NotFoundException('Group', id);
    }

    return group;
  }

  async remove(id: string): Promise<void> {
    try {
      // Проверяем существование группы
      await this.findOne(id);

      // Проверяем, есть ли студенты в этой группе
      const studentsCount = await this.db.user.count({
        where: { groupId: id },
      });

      if (studentsCount > 0) {
        throw new BusinessException(
          `Cannot delete group: ${studentsCount} students are assigned to this group`,
        );
      }

      await this.db.group.delete({
        where: { id },
      });

      this.logInfo(`Group deleted: ${id}`);
    } catch (error) {
      if (
        error instanceof BusinessException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logError('Failed to delete group', error as Error, { id });
      throw new BusinessException('Failed to delete group');
    }
  }
}

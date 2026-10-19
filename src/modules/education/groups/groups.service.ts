import { Injectable } from '@nestjs/common';
import { Group } from '@prisma/client';
import { DatabaseService } from '../../../database/database.service';
import { CreateGroupDto } from './dto/group.dto';
import { BaseService, BusinessException, NotFoundException } from '@common';
import { compareRu } from '../education-sort';

/** Предмет из расписания группы с преподавателями именно этой группы */
export interface GroupSubjectItem {
  id: string;
  name: string;
  teachers: { id: string; fullName: string }[];
}

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
          foreignId: createGroupDto.foreignId,
        },
      });

      if (existingGroup) {
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
      throw error;
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
      throw error;
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

  /**
   * Предметы из расписания группы. Преподаватели — из связей этой группы
   * (group_subject_teachers), а не все, кто ведёт предмет в университете.
   * Нет группы — 404; нет расписания — пустой список.
   */
  async findSubjects(groupId: string): Promise<GroupSubjectItem[]> {
    await this.findOne(groupId);

    const groupSubjects = await this.db.groupSubject.findMany({
      where: { groupId, isActive: true, subject: { isActive: true } },
      select: { subject: { select: { id: true, name: true } } },
    });
    if (groupSubjects.length === 0) {
      return [];
    }

    const links = await this.db.groupSubjectTeacher.findMany({
      where: {
        groupId,
        isActive: true,
        subjectId: { in: groupSubjects.map((gs) => gs.subject.id) },
      },
      select: {
        subjectId: true,
        teacher: { select: { id: true, fullName: true } },
      },
    });

    const teachersBySubject = new Map<string, GroupSubjectItem['teachers']>();
    for (const link of links) {
      const teachers = teachersBySubject.get(link.subjectId) ?? [];
      teachers.push(link.teacher);
      teachersBySubject.set(link.subjectId, teachers);
    }

    return groupSubjects
      .map(({ subject }) => ({
        id: subject.id,
        name: subject.name,
        teachers: (teachersBySubject.get(subject.id) ?? []).sort((a, b) =>
          compareRu(a.fullName, b.fullName),
        ),
      }))
      .sort((a, b) => compareRu(a.name, b.name));
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
      throw error;
    }
  }
}

import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { CreateDealDto, UpdateDealDto, DealFilterDto } from './dto/deal.dto';
import {
  BaseService,
  BusinessException,
  NotFoundException,
  PaginatedResult,
  PaginationDto,
} from '@common';
import { Prisma } from '@prisma/client';

@Injectable()
export class DealsService extends BaseService {
  constructor(private readonly db: DatabaseService) {
    super();
  }

  async create(dto: CreateDealDto) {
    // Проверка существования участников и связей
    const [student, tutor, subject, teacher] = await Promise.all([
      this.db.user.findUnique({ where: { id: dto.studentId } }),
      this.db.user.findUnique({ where: { id: dto.tutorId } }),
      this.db.subject.findUnique({ where: { id: dto.subjectId } }),
      this.db.teacher.findUnique({ where: { id: dto.teacherId } }),
    ]);
    if (!student) throw new NotFoundException('User', dto.studentId);
    if (!tutor) throw new NotFoundException('User', dto.tutorId);
    if (!subject) throw new NotFoundException('Subject', dto.subjectId);
    if (!teacher) throw new NotFoundException('Teacher', dto.teacherId);
    // Проверка на дубликат сделки по отклику
    if (dto.serviceResponseId) {
      const exists = await this.db.deal.findFirst({
        where: { serviceResponseId: dto.serviceResponseId },
      });
      if (exists)
        throw new BusinessException('Сделка по этому отклику уже существует.');
    }
    if (dto.requestResponseId) {
      const exists = await this.db.deal.findFirst({
        where: { requestResponseId: dto.requestResponseId },
      });
      if (exists)
        throw new BusinessException('Сделка по этому отклику уже существует.');
    }
    // Создание сделки
    return this.db.deal.create({
      data: {
        studentId: dto.studentId,
        tutorId: dto.tutorId,
        subjectId: dto.subjectId,
        teacherId: dto.teacherId,
        price: dto.price,
        deadline: dto.deadline,
        status: 'PENDING',
        serviceResponseId: dto.serviceResponseId,
        requestResponseId: dto.requestResponseId,
      },
    });
  }

  async findAll(
    pagination: PaginationDto,
    filter: DealFilterDto,
  ): Promise<PaginatedResult<any>> {
    const where: Prisma.DealWhereInput = {};
    if (filter.studentId) where.studentId = filter.studentId;
    if (filter.tutorId) where.tutorId = filter.tutorId;
    if (filter.subjectId) where.subjectId = filter.subjectId;
    if (filter.teacherId) where.teacherId = filter.teacherId;
    if (filter.status) where.status = filter.status as any;
    if (filter.minPrice !== undefined || filter.maxPrice !== undefined) {
      where.price = {};
      if (filter.minPrice !== undefined) where.price.gte = filter.minPrice;
      if (filter.maxPrice !== undefined) where.price.lte = filter.maxPrice;
    }
    const [items, total] = await Promise.all([
      this.db.deal.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          student: true,
          tutor: true,
          subject: true,
          teacher: true,
          serviceResponse: true,
          requestResponse: true,
          review: true,
        },
      }),
      this.db.deal.count({ where }),
    ]);
    return {
      items,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async findOne(id: string) {
    const item = await this.db.deal.findUnique({
      where: { id },
      include: {
        student: true,
        tutor: true,
        subject: true,
        teacher: true,
        serviceResponse: true,
        requestResponse: true,
        review: true,
      },
    });
    if (!item) throw new NotFoundException('Deal', id);
    return item;
  }

  async update(id: string, dto: UpdateDealDto) {
    await this.findOne(id);
    return this.db.deal.update({
      where: { id },
      data: { ...dto, updatedAt: new Date() },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.db.deal.delete({ where: { id } });
  }
}

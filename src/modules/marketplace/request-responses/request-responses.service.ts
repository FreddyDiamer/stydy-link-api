import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import {
  CreateRequestResponseDto,
  UpdateRequestResponseDto,
  RequestResponseFilterDto,
} from './dto/request-response.dto';
import { BaseService, BusinessException, NotFoundException } from '@common';
import { Prisma, RequestResponse } from '@prisma/client';

@Injectable()
export class RequestResponsesService extends BaseService {
  constructor(private readonly db: DatabaseService) {
    super();
  }

  async create(dto: CreateRequestResponseDto) {
    // Проверка существования репетитора и заявки
    const [tutor, request] = await Promise.all([
      this.db.user.findUnique({ where: { id: dto.tutorId } }),
      this.db.request.findUnique({ where: { id: dto.requestId } }),
    ]);
    if (!tutor) throw new NotFoundException('User', dto.tutorId);
    if (!request) throw new NotFoundException('Request', dto.requestId);
    // Проверка на дубликат отклика
    const exists = await this.db.requestResponse.findFirst({
      where: { tutorId: dto.tutorId, requestId: dto.requestId },
    });
    if (exists)
      throw new BusinessException('Вы уже откликнулись на эту заявку.');
    // Создание отклика
    return this.db.requestResponse.create({
      data: {
        tutorId: dto.tutorId,
        requestId: dto.requestId,
        message: dto.message,
        price: dto.price,
        proposedDeadline: dto.proposedDeadline,
        status: 'PENDING',
      },
    });
  }

  async findAll(filter: RequestResponseFilterDto): Promise<RequestResponse[]> {
    const where: Prisma.RequestResponseWhereInput = {};
    if (filter.tutorId) where.tutorId = filter.tutorId;
    if (filter.requestId) where.requestId = filter.requestId;
    if (filter.status) where.status = filter.status as any;
    if (filter.minPrice !== undefined || filter.maxPrice !== undefined) {
      where.price = {};
      if (filter.minPrice !== undefined) where.price.gte = filter.minPrice;
      if (filter.maxPrice !== undefined) where.price.lte = filter.maxPrice;
    }
    if (filter.search?.trim()) {
      where.message = { contains: filter.search.trim(), mode: 'insensitive' };
    }
    const items = await this.db.requestResponse.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return items;
  }

  async findOne(id: string) {
    const item = await this.db.requestResponse.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('RequestResponse', id);
    return item;
  }

  async update(id: string, dto: UpdateRequestResponseDto) {
    await this.findOne(id);
    return this.db.requestResponse.update({
      where: { id },
      data: { ...dto, updatedAt: new Date() },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.db.requestResponse.delete({ where: { id } });
  }
}

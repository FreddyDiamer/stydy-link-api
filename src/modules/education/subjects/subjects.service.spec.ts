import { Test } from '@nestjs/testing';
import { SubjectsService } from './subjects.service';
import { SubjectFilterDto } from './dto/subject.dto';
import { DatabaseService } from '../../../database/database.service';
import { createDatabaseMock, DatabaseMock } from '../../../test-support/mocks';

const filter = (values: Partial<SubjectFilterDto> = {}) =>
  Object.assign(new SubjectFilterDto(), values);

const subject = (name: string) => ({ id: name, name, isActive: true });

describe('SubjectsService', () => {
  let service: SubjectsService;
  let db: DatabaseMock;

  beforeEach(async () => {
    db = createDatabaseMock();

    const moduleRef = await Test.createTestingModule({
      providers: [SubjectsService, { provide: DatabaseService, useValue: db }],
    }).compile();

    service = moduleRef.get(SubjectsService);
    db.subject.findMany.mockResolvedValue([]);
  });

  describe('список и поиск', () => {
    it('без учёта регистра: сначала начинающиеся с запроса, затем содержащие, остальные отсеяны', async () => {
      db.subject.findMany.mockResolvedValue([
        subject('Высшая математика'),
        subject('Физика'),
        subject('Математика'),
        subject('Дискретная математика'),
        subject('Математический анализ'),
      ]);

      const result = await service.findAll(
        filter({ search: '  МАТЕМ ' }),
        filter({ search: '  МАТЕМ ' }),
      );

      expect(result.map((s) => s.name)).toEqual([
        'Математика',
        'Математический анализ',
        'Высшая математика',
        'Дискретная математика',
      ]);
      // сравнение в приложении: ILIKE по кириллице зависит от локали базы
      expect(db.subject.findMany.mock.calls[0][0].where.name).toBeUndefined();
    });

    it('отдаёт только { id, name, isActive } без вложенных данных', async () => {
      await service.findAll(filter(), filter());

      const args = db.subject.findMany.mock.calls[0][0];
      expect(args.select).toEqual({ id: true, name: true, isActive: true });
      expect(args.include).toBeUndefined();
    });

    it('по умолчанию ищет только активные, явный isActive=false — неактивные', async () => {
      await service.findAll(filter(), filter());
      await service.findAll(
        filter({ isActive: false }),
        filter({ isActive: false }),
      );

      expect(db.subject.findMany.mock.calls[0][0].where.isActive).toBe(true);
      expect(db.subject.findMany.mock.calls[1][0].where.isActive).toBe(false);
    });

    it('режет страницу после ранжирования', async () => {
      db.subject.findMany.mockResolvedValue(
        ['Г', 'В', 'Б', 'А', 'Д'].map(subject),
      );

      const page2 = filter({ page: 2, limit: 2 });
      const result = await service.findAll(page2, page2);

      expect(result.map((s) => s.name)).toEqual(['В', 'Г']);
    });
  });

  it('активные предметы — лёгкие и по алфавиту', async () => {
    db.subject.findMany.mockResolvedValue([
      subject('Физика'),
      subject('Алгебра'),
    ]);

    const result = await service.findActive();

    expect(result.map((s) => s.name)).toEqual(['Алгебра', 'Физика']);
    expect(db.subject.findMany.mock.calls[0][0].select).toEqual({
      id: true,
      name: true,
      isActive: true,
    });
  });
});

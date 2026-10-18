import { Test } from '@nestjs/testing';
import { GroupsService } from './groups.service';
import { DatabaseService } from '../../../database/database.service';
import {
  createDatabaseMock,
  DatabaseMock,
  expectBusinessError,
} from '../../../test-support/mocks';

const GROUP = 'group-1';

const subjectRow = (id: string, name: string) => ({ subject: { id, name } });
const link = (subjectId: string, id: string, fullName: string) => ({
  subjectId,
  teacher: { id, fullName },
});

describe('GroupsService', () => {
  let service: GroupsService;
  let db: DatabaseMock;

  beforeEach(async () => {
    db = createDatabaseMock();

    const moduleRef = await Test.createTestingModule({
      providers: [GroupsService, { provide: DatabaseService, useValue: db }],
    }).compile();

    service = moduleRef.get(GroupsService);
    db.group.findUnique.mockResolvedValue({ id: GROUP, number: '4212' });
  });

  describe('предметы группы', () => {
    it('сортирует предметы и преподавателей по-русски', async () => {
      // «ё» по кодовой точке идёт после «я» — русская сортировка ставит её к «е»
      db.groupSubject.findMany.mockResolvedValue([
        subjectRow('s-yaz', 'Языки программирования'),
        subjectRow('s-yo', 'Ёмкостные системы'),
        subjectRow('s-alg', 'Алгебра'),
      ]);
      db.groupSubjectTeacher.findMany.mockResolvedValue([
        link('s-alg', 't-2', 'Яковлев Я.Я.'),
        link('s-alg', 't-1', 'Ёлкин Ё.Ё.'),
        link('s-alg', 't-3', 'Абрамов А.А.'),
      ]);

      const result = await service.findSubjects(GROUP);

      expect(result.map((s) => s.name)).toEqual([
        'Алгебра',
        'Ёмкостные системы',
        'Языки программирования',
      ]);
      expect(result[0].teachers.map((t) => t.fullName)).toEqual([
        'Абрамов А.А.',
        'Ёлкин Ё.Ё.',
        'Яковлев Я.Я.',
      ]);
    });

    it('отдаёт преподавателей этой группы по каждой паре и предмет без преподавателей — с пустым списком', async () => {
      db.groupSubject.findMany.mockResolvedValue([
        subjectRow('s-math', 'Математика'),
        subjectRow('s-pe', 'Физкультура'),
      ]);
      db.groupSubjectTeacher.findMany.mockResolvedValue([
        link('s-math', 't-1', 'Иванов И.И.'),
      ]);

      await expect(service.findSubjects(GROUP)).resolves.toEqual([
        {
          id: 's-math',
          name: 'Математика',
          teachers: [{ id: 't-1', fullName: 'Иванов И.И.' }],
        },
        { id: 's-pe', name: 'Физкультура', teachers: [] },
      ]);
    });

    it('берёт только активные связи и активные предметы этой группы', async () => {
      db.groupSubject.findMany.mockResolvedValue([
        subjectRow('s-math', 'Математика'),
      ]);
      db.groupSubjectTeacher.findMany.mockResolvedValue([]);

      await service.findSubjects(GROUP);

      expect(db.groupSubject.findMany.mock.calls[0][0].where).toEqual({
        groupId: GROUP,
        isActive: true,
        subject: { isActive: true },
      });
      expect(db.groupSubjectTeacher.findMany.mock.calls[0][0].where).toEqual({
        groupId: GROUP,
        isActive: true,
        subjectId: { in: ['s-math'] },
      });
    });

    it('без расписания отдаёт пустой список и не ищет преподавателей', async () => {
      db.groupSubject.findMany.mockResolvedValue([]);

      await expect(service.findSubjects(GROUP)).resolves.toEqual([]);
      expect(db.groupSubjectTeacher.findMany).not.toHaveBeenCalled();
    });

    it('по несуществующей группе отвечает 404', async () => {
      db.group.findUnique.mockResolvedValue(null);

      await expectBusinessError(() => service.findSubjects(GROUP), {
        code: 'NOT_FOUND',
        status: 404,
      });
      expect(db.groupSubject.findMany).not.toHaveBeenCalled();
    });
  });
});

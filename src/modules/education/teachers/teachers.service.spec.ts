import { Test } from '@nestjs/testing';
import { TeachersService } from './teachers.service';
import { TeacherFilterDto } from './dto/teacher.dto';
import { DatabaseService } from '../../../database/database.service';
import { createDatabaseMock, DatabaseMock } from '../../../test-support/mocks';

const filter = (values: Partial<TeacherFilterDto> = {}) =>
  Object.assign(new TeacherFilterDto(), values);

const teacher = (fullName: string) => ({ id: fullName, fullName });

describe('TeachersService', () => {
  let service: TeachersService;
  let db: DatabaseMock;

  beforeEach(async () => {
    db = createDatabaseMock();

    const moduleRef = await Test.createTestingModule({
      providers: [TeachersService, { provide: DatabaseService, useValue: db }],
    }).compile();

    service = moduleRef.get(TeachersService);
    db.teacher.findMany.mockResolvedValue([]);
  });

  it('поиск: сначала ФИО, начинающиеся с запроса, и только { id, fullName }', async () => {
    db.teacher.findMany.mockResolvedValue([
      teacher('Петров Иван Иванович'),
      teacher('Сидорова Анна Петровна'),
      teacher('Иванова Мария Сергеевна'),
      teacher('Иванов Иван Иванович'),
    ]);

    const result = await service.findAll(
      filter({ search: ' ИВАН ' }),
      filter({ search: ' ИВАН ' }),
    );

    expect(result.map((t) => t.fullName)).toEqual([
      'Иванов Иван Иванович',
      'Иванова Мария Сергеевна',
      'Петров Иван Иванович',
    ]);
    const args = db.teacher.findMany.mock.calls[0][0];
    expect(args.select).toEqual({ id: true, fullName: true });
    expect(args.where).toBeUndefined();
  });

  it('преподаватели предмета — все, по алфавиту, только активные связи', async () => {
    db.teacher.findMany.mockResolvedValue(
      Array.from({ length: 27 }, (_, i) =>
        teacher(`Преподаватель ${String(27 - i).padStart(2, '0')}`),
      ),
    );

    const result = await service.getTeachersBySubject('subject-1');

    expect(result).toHaveLength(27);
    expect(result[0].fullName).toBe('Преподаватель 01');
    const args = db.teacher.findMany.mock.calls[0][0];
    expect(args.take).toBeUndefined();
    expect(args.select).toEqual({ id: true, fullName: true });
    expect(args.where).toEqual({
      teacherSubjects: { some: { subjectId: 'subject-1', isActive: true } },
    });
  });
});

import { Test } from '@nestjs/testing';
import { TeacherSubjectsService } from './teacher-subjects.service';
import { DatabaseService } from '../../../database/database.service';
import { createDatabaseMock, DatabaseMock } from '../../../test-support/mocks';

describe('TeacherSubjectsService', () => {
  let service: TeacherSubjectsService;
  let db: DatabaseMock;

  beforeEach(async () => {
    db = createDatabaseMock();

    const moduleRef = await Test.createTestingModule({
      providers: [
        TeacherSubjectsService,
        { provide: DatabaseService, useValue: db },
      ],
    }).compile();

    service = moduleRef.get(TeacherSubjectsService);
  });

  it('предметы преподавателя — все активные, { id, subject: { id, name } }, по названию', async () => {
    db.teacherSubject.findMany.mockResolvedValue([
      { id: 'ts-2', subject: { id: 's-2', name: 'Физика' } },
      { id: 'ts-1', subject: { id: 's-1', name: 'Алгебра' } },
    ]);

    await expect(service.findActiveByTeacher('teacher-1')).resolves.toEqual([
      { id: 'ts-1', subject: { id: 's-1', name: 'Алгебра' } },
      { id: 'ts-2', subject: { id: 's-2', name: 'Физика' } },
    ]);
    const args = db.teacherSubject.findMany.mock.calls[0][0];
    expect(args.take).toBeUndefined();
    expect(args.where).toEqual({
      teacherId: 'teacher-1',
      isActive: true,
      subject: { isActive: true },
    });
  });
});

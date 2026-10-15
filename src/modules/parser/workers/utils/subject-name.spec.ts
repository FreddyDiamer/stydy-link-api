import { normalizeSubjectName } from './subject-name';

describe('normalizeSubjectName', () => {
  it('убирает пробелы по краям и схлопывает внутренние', () => {
    expect(normalizeSubjectName('  Линейная   алгебра ')).toBe(
      'Линейная алгебра',
    );
  });

  it('переводы строк и табы считает пробелами', () => {
    expect(normalizeSubjectName('Физика\n\tи химия')).toBe('Физика и химия');
  });

  it('пустое название остаётся пустым — такой предмет пропускается', () => {
    expect(normalizeSubjectName('   ')).toBe('');
    expect(normalizeSubjectName(undefined)).toBe('');
  });
});

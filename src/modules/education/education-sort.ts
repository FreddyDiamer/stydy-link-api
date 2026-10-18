/**
 * Порядок справочников по-русски и ранжирование поиска.
 *
 * Сортируем и ищем в приложении, а не в Postgres: порядок orderBy зависит от
 * collation базы, а ILIKE без учёта регистра работает для кириллицы только при
 * подходящей локали (на базе с локалью C «МАТЕМ» не находит «Математику»).
 * Справочники маленькие (сотни–тысячи строк), так что это дёшево.
 */
const collator = new Intl.Collator('ru');

export const compareRu = (a: string, b: string): number =>
  collator.compare(a, b);

export function sortByName<T>(items: T[], name: (item: T) => string): T[] {
  return [...items].sort((a, b) => compareRu(name(a), name(b)));
}

/**
 * Поиск без учёта регистра (пробелы по краям запроса отбрасываются).
 * С непустым запросом остаются только названия, содержащие его: сначала те, что
 * начинаются с запроса, затем остальные; внутри каждой части — по алфавиту.
 * Без запроса — всё по алфавиту.
 */
export function searchByName<T>(
  items: T[],
  name: (item: T) => string,
  search?: string,
): T[] {
  const query = search?.trim().toLocaleLowerCase('ru');
  if (!query) {
    return sortByName(items, name);
  }
  const ranked: { item: T; rank: number }[] = [];
  for (const item of items) {
    const position = name(item).toLocaleLowerCase('ru').indexOf(query);
    if (position >= 0) {
      ranked.push({ item, rank: position === 0 ? 0 : 1 });
    }
  }
  return ranked
    .sort((a, b) => a.rank - b.rank || compareRu(name(a.item), name(b.item)))
    .map(({ item }) => item);
}

import { KaiApiClient } from './kai-api-client';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe('KaiApiClient', () => {
  let client: KaiApiClient;
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    client = new KaiApiClient();
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('ищет преподавателей на странице расписания для сотрудников', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([
        { id: 'AzIAbdullin', lecturer: 'Абдуллин Азат Ильдарович' },
      ]),
    );

    await expect(client.getTeachers('А')).resolves.toEqual([
      { id: 'AzIAbdullin', lecturer: 'Абдуллин Азат Ильдарович' },
    ]);
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.origin + url.pathname).toBe(
      'https://kai.ru/web/sotrudniku/raspisanie',
    );
    expect(url.searchParams.get('query')).toBe('А');
  });

  // Переезд страницы на kai.ru должен попадать в errors отчёта парсера,
  // а не превращаться в пустой результат с нулём ошибок
  it.each([
    ['преподаватели', (c: KaiApiClient) => c.getTeachers('А')],
    ['группы', (c: KaiApiClient) => c.getGroups('4')],
    ['расписание', (c: KaiApiClient) => c.getSchedule('28536', '4toto')],
  ])('404 на запросе «%s» — ошибка, а не пустой список', async (_, call) => {
    fetchMock.mockResolvedValue(new Response('<html></html>', { status: 404 }));

    await expect(call(client)).rejects.toThrow(/404/);
  });

  it('склеивает расписание очной группы по дням в один список', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        '1': [{ disciplName: 'Физика', prepodLogin: 'IvanovII' }],
        '3': [{ disciplName: 'Химия', prepodLogin: 'PetrovPP' }],
      }),
    );

    await expect(client.getSchedule('28536', '4toto')).resolves.toEqual([
      { disciplName: 'Физика', prepodLogin: 'IvanovII' },
      { disciplName: 'Химия', prepodLogin: 'PetrovPP' },
    ]);
  });
});

import {
  assertChangedDeadlineNotPast,
  assertDeadlineNotPast,
  DEADLINE_IN_PAST_MESSAGE,
  parseClientDate,
  startOfTodayInMoscow,
} from './client-date';

// 15 октября, 00:30 по Москве = 14 октября, 21:30 UTC
const NOW = new Date('2026-10-14T21:30:00.000Z');

describe('даты с клиента', () => {
  it('дата без времени — конец этого дня по Москве', () => {
    expect(parseClientDate('2026-10-14')).toEqual(
      new Date('2026-10-14T20:59:59.999Z'),
    );
  });

  it('полная ISO-8601 строка — как есть', () => {
    expect(parseClientDate('2026-10-14T21:00:00.000Z')).toEqual(
      new Date('2026-10-14T21:00:00.000Z'),
    );
  });

  it.each(['завтра', '14.10.2026', '2026-02-30', ''])(
    'неразборчивое «%s» не превращается в дату — его отклонит валидация',
    (value) => {
      expect(parseClientDate(value)).toBe(value);
    },
  );

  it('не-строки не трогает', () => {
    expect(parseClientDate(undefined)).toBeUndefined();
    expect(parseClientDate(123)).toBe(123);
  });

  it('начало сегодняшнего дня считается по Москве, а не по UTC', () => {
    expect(startOfTodayInMoscow(NOW)).toEqual(
      new Date('2026-10-14T21:00:00.000Z'),
    );
  });
});

describe('срок не в прошлом', () => {
  it('вчерашний по Москве срок — 400 с понятным текстом', () => {
    // 14 октября по Москве уже прошло, хотя в UTC ещё 14-е
    const yesterday = parseClientDate('2026-10-14') as Date;

    expect(() => assertDeadlineNotPast(yesterday, NOW)).toThrow(
      DEADLINE_IN_PAST_MESSAGE,
    );
  });

  it('сегодняшний и будущий срок проходят', () => {
    expect(() =>
      assertDeadlineNotPast(parseClientDate('2026-10-15') as Date, NOW),
    ).not.toThrow();
    expect(() =>
      assertDeadlineNotPast(new Date('2026-10-14T21:00:00.000Z'), NOW),
    ).not.toThrow();
  });

  it('при правке прошедший срок не мешает, если его не меняют', () => {
    const past = new Date('2026-10-01T20:59:59.999Z');

    expect(() =>
      assertChangedDeadlineNotPast(new Date(past), past, NOW),
    ).not.toThrow();
    expect(() =>
      assertChangedDeadlineNotPast(
        new Date('2026-10-02T20:59:59.999Z'),
        past,
        NOW,
      ),
    ).toThrow(DEADLINE_IN_PAST_MESSAGE);
    expect(() =>
      assertChangedDeadlineNotPast(undefined, past, NOW),
    ).not.toThrow();
  });
});

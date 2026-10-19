import type { Season } from '../types';

export const SP = 0 as Season;
export const SU = 1 as Season;
export const FA = 2 as Season;
export const WI = 3 as Season;

export const SEASON_RU = ['Весна', 'Лето', 'Осень', 'Зима'];
export const SEASON_FROM = ['с весны', 'с лета', 'с осени', 'с зимы'];
export const SEASON_KEY = ['spring', 'summer', 'fall', 'winter'];
export const DOW = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
export const WIKI = 'https://ru.stardewvalleywiki.com/';

/**
 * Один словарь на бейджи и на фильтры. Раньше их было два, и «позже» в бейдже
 * расходилось с «позже в этом году» в чипе фильтра — связь приходилось
 * достраивать самому.
 */
export const LVL: Record<string, string> = {
  now: 'можно сейчас',
  cond: 'нужно условие',
  later: 'позже в этом году',
  cart: 'только у торговки',
  past: 'в 1-м году уже никак',
};

export const LVL_ORDER = ['now', 'cond', 'later', 'last', 'cart', 'past'] as const;

export const LVL_NAME: Record<string, string> = {
  ...LVL,
  last: 'последний сезон сбора',
};

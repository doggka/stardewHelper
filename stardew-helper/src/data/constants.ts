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

export const LVL: Record<string, string> = {
  now: 'можно сейчас',
  cond: 'при условии',
  later: 'позже',
  cart: 'только у торговки',
  past: 'в Y1 уже никак',
};

export const LVL_ORDER = ['now', 'cond', 'later', 'last', 'cart', 'past'] as const;

export const LVL_NAME: Record<string, string> = {
  now: 'можно сейчас',
  cond: 'при условии',
  later: 'позже в этом году',
  last: 'последний сезон сбора',
  cart: 'только у торговки',
  past: 'в Y1 уже никак',
};

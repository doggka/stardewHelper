import type { Season } from '../types';

/**
 * Фестивали: даты известны заранее, и подготовка к ним нужна заранее.
 * Поэтому они живут во вкладке «День» предупреждением за несколько дней,
 * а не сюрпризом в то самое утро.
 *
 * В день фестиваля магазины закрыты, а на ферму времени почти нет —
 * это тоже стоит сказать.
 */
export interface Festival {
  season: Season;
  /** первый день; у Ночного рынка их три */
  day: number;
  days?: number;
  name: string;
  where: string;
  time: string;
  /** что сделать заранее; пусто — готовиться не надо */
  prep?: string;
}

export const FESTIVALS: Festival[] = [
  { season: 0, day: 13, name: 'Праздник яйца', where: 'площадь города', time: '09:00–14:00',
    prep: 'ничего не нужно, но победа в поиске яиц даёт Клубничные семена — единственный способ взять их весной 1-го года' },
  { season: 0, day: 24, name: 'Танец цветов', where: 'к западу от ранчо Марни', time: '09:00–14:00',
    prep: 'нужен букет (800 з. у Пьера), чтобы кого-то пригласить' },
  { season: 1, day: 11, name: 'Луау', where: 'пляж', time: '09:00–14:00',
    prep: 'возьми один предмет подороже в котёл: чем дороже, тем лучше реакция' },
  { season: 1, day: 28, name: 'Танец светлячков', where: 'пляж', time: '22:00–00:00' },
  { season: 2, day: 16, name: 'Ярмарка долины Стардью', where: 'площадь города', time: '09:00–15:00',
    prep: 'собери девять предметов на выставку — это главный источник звёздных жетонов' },
  { season: 2, day: 27, name: 'Ночь духов', where: 'площадь города', time: '22:00–23:50',
    prep: 'в лабиринте прячется Золотая тыква' },
  { season: 3, day: 8, name: 'Праздник льда', where: 'лес', time: '09:00–14:00',
    prep: 'готовиться не надо; за победу в подлёдной рыбалке дают Дихлорид железа' },
  { season: 3, day: 15, days: 3, name: 'Ночной рынок', where: 'пляж', time: '17:00–02:00',
    prep: 'торговка работает все три дня подряд — последний шанс купить редкие семена в этом году' },
  { season: 3, day: 25, name: 'Пир зимней звезды', where: 'площадь города', time: '09:00–14:00',
    prep: 'нужен подарок для тайного друга — его назовут за несколько дней' },
];

/** Ближайший фестиваль начиная с указанного дня сезона. */
export function nextFestival(season: Season, day: number): { f: Festival; inDays: number } | null {
  let best: { f: Festival; inDays: number } | null = null;
  for (const f of FESTIVALS) {
    if (f.season !== season) continue;
    const last = f.day + (f.days ?? 1) - 1;
    if (last < day) continue;
    const inDays = Math.max(0, f.day - day);
    if (!best || inDays < best.inDays) best = { f, inDays };
  }
  return best;
}

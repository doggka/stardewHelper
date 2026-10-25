import type { HeldItem } from '../types';
import { ITEM_IDS } from '../data/itemIds';
import { ALL, S } from '../state';
import { bprog, done } from './status';
import { belongings } from './have';

/**
 * Выставка на ярмарке долины Стардью (16 осени).
 *
 * Очки считает сама игра в Event.judgeGrange(). Прочитать её код
 * рефлексией нельзя — видны только сигнатуры, — поэтому правила взяты
 * с вики и проверяются фактом: после ярмарки известно, сколько начислили
 * судьи, и расхождение правит таблицу, а не объяснение.
 *
 * Пока расчёт не сверен с игрой, показываем вывод («хватит на первое
 * место»), а не число.
 */

/** 14 очков дают просто за участие. */
const BASE = 14;

/**
 * Очки за предмет по цене продажи и качеству.
 * Строки — нижние границы цены.
 *
 * Отсюда два неочевидных следствия, ради которых всё и затевалось:
 * выше 400 з. цена не помогает вовсе, а иридиевое качество пробивает
 * потолок обычных шести очков.
 */
const POINTS: { from: number; q: [number, number, number, number] }[] = [
  { from: 400, q: [6, 6, 6, 8] },
  { from: 300, q: [5, 6, 6, 8] },
  { from: 200, q: [4, 5, 6, 8] },
  { from: 90, q: [3, 4, 5, 7] },
  { from: 20, q: [2, 3, 4, 6] },
  { from: 0, q: [1, 2, 3, 5] },
];

/** Восемь категорий выставки; номера — константы игры, снятые рефлексией. */
export const GRANGE_CATS: { key: string; name: string; cats: number[] }[] = [
  { key: 'animal', name: 'продукты животных', cats: [-5, -6, -14, -18] },
  { key: 'artisan', name: 'ремесло', cats: [-26] },
  { key: 'cooking', name: 'кулинария', cats: [-7] },
  { key: 'fish', name: 'рыба', cats: [-4] },
  { key: 'forage', name: 'дикоросы и цветы', cats: [-81, -80, -27] },
  { key: 'fruit', name: 'фрукты', cats: [-79] },
  { key: 'mineral', name: 'минералы', cats: [-2, -12] },
  { key: 'veg', name: 'овощи', cats: [-75] },
];

const QUALITY_MULT = [1, 1.25, 1.5, 1.5, 2];

/** Цена, по которой судьи считают очки: с качеством и профессиями. */
export function sellPrice(it: HeldItem): number {
  const prof = S.save?.farm?.professions ?? [];
  let p = it.price * (QUALITY_MULT[it.quality] ?? 1);
  // Tiller: +10 % культурам (овощи, фрукты, цветы)
  if (prof.indexOf(1) >= 0 && [-75, -79, -80].indexOf(it.cat) >= 0) p *= 1.1;
  // Artisan: +40 % ремесленным товарам
  if (prof.indexOf(4) >= 0 && it.cat === -26) p *= 1.4;
  return Math.floor(p);
}

export function itemPoints(it: HeldItem): number {
  const price = sellPrice(it);
  const row = POINTS.find((r) => price >= r.from) ?? POINTS[POINTS.length - 1];
  // в игре качество 3 не используется, таблица это учитывает
  return row.q[Math.min(3, it.quality === 4 ? 3 : it.quality)];
}

export const catOf = (it: HeldItem): string | null =>
  GRANGE_CATS.find((c) => c.cats.indexOf(it.cat) >= 0)?.key ?? null;

export interface Grange {
  picks: HeldItem[];
  score: number;
  /** сколько из восьми категорий представлено */
  cats: number;
  place: string;
}

/**
 * Подбор девятки.
 *
 * Сначала закрываем категории: каждая новая даёт +5, а это больше, чем
 * разница между любыми двумя предметами. Потом добиваем свободные слоты
 * самым очковым из оставшегося.
 */
export function pickGrange(): Grange | null {
  const b = belongings();
  if (!b) return null;

  // Предметы, которые ещё нужны для узелков, на прилавок не ставим.
  // После судейства их надо забрать вручную, забытое уходит в бюро
  // находок — потерять так крупную бутыль молока слишком легко.
  // Потерянные на этом очки дешевле потерянного узелка.
  const needed = new Set<string>();
  ALL.forEach((it) => {
    if (it.bundle.room.extra || done(it) || bprog(it.bundle).ok) return;
    const gid = ITEM_IDS[it.id];
    if (gid) needed.add(gid);
  });

  // по одному экземпляру каждого вида: на прилавок нужен один предмет
  const seen = new Set<string>();
  const pool: HeldItem[] = [];
  for (const it of b.items) {
    const k = it.id + '|' + it.quality;
    if (seen.has(k) || needed.has(it.id) || !it.price) continue;
    seen.add(k);
    pool.push(it);
  }
  if (!pool.length) return null;
  pool.sort((a, c) => itemPoints(c) - itemPoints(a) || sellPrice(c) - sellPrice(a));

  const picks: HeldItem[] = [];
  const used = new Set<string>();
  for (const cat of GRANGE_CATS) {
    if (picks.length >= 9) break;
    const best = pool.find((it) => catOf(it) === cat.key && !used.has(it.id + '|' + it.quality));
    if (!best) continue;
    picks.push(best);
    used.add(best.id + '|' + best.quality);
  }
  for (const it of pool) {
    if (picks.length >= 9) break;
    const k = it.id + '|' + it.quality;
    if (used.has(k)) continue;
    picks.push(it);
    used.add(k);
  }

  const cats = new Set(picks.map(catOf).filter(Boolean)).size;
  const score = BASE + (2 * picks.length - 9)
    + Math.min(30, cats * 5)
    + picks.reduce((a, it) => a + itemPoints(it), 0);

  const place = score >= 90 ? 'первое место'
    : score >= 75 ? 'второе место'
    : score >= 60 ? 'третье место'
    : 'четвёртое место';

  return { picks, score, cats, place };
}

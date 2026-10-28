import type { HeldItem } from '../types';
import { LUAU_BEST, LUAU_WORST } from '../data/festivals';
import { belongings } from './have';

/**
 * Что бросить в котёл на Луау.
 *
 * Механика не та, что на выставке ярмарки: там пороги цены, здесь —
 * списки предметов с учётом качества. Поэтому и считаем по спискам,
 * а не по цене.
 *
 * Знаем мы только две крайние группы — они и решают. Если ничего из
 * верхней нет, честнее сказать «лучшего нет, подойдёт что угодно
 * дорогое», чем выдумывать расчёт для середины.
 */

export interface LuauPick {
  /** что бросить; null — подходящего нет */
  item: HeldItem | null;
  ru: string;
  /** то, что ни в коем случае бросать нельзя, и оно у тебя есть */
  avoid: HeldItem[];
}

const Q = ['', ' (серебро)', ' (золото)', '', ' (иридий)'];

export function luauName(h: HeldItem, ru?: string): string {
  return (ru ?? h.name) + (Q[h.quality] ?? '');
}

export function pickLuau(): LuauPick | null {
  const b = belongings();
  if (!b) return null;

  let best: { it: HeldItem; ru: string } | null = null;
  for (const want of LUAU_BEST) {
    for (const it of b.items) {
      const hit = want.suffix
        ? it.name === want.name || it.name.endsWith(' ' + want.name)
        : it.name === want.name;
      if (!hit) continue;
      if (it.quality < (want.minQuality ?? 0)) continue;
      // при прочих равных берём качество повыше: оно же и дороже
      if (!best || it.quality > best.it.quality) best = { it, ru: want.ru };
    }
  }

  const avoid = b.items.filter((it) => LUAU_WORST.indexOf(it.name) >= 0);

  return {
    item: best ? best.it : null,
    ru: best ? best.ru : '',
    avoid,
  };
}

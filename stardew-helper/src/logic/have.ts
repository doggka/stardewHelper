import type { Belongings, GrowingCrop, HeldItem, Item } from '../types';
import { ITEM_IDS } from '../data/itemIds';
import { LOC_RU } from '../data/locNames';

/**
 * «Это у меня уже есть». Сверка строго по itemId: отображаемые имена в игре
 * не уникальны — id 182 и 174 оба называются «Большое яйцо», и сверка по
 * названию показала бы белое яйцо вместо коричневого.
 *
 * Если таблицы id для предмета нет — молчим. Лучше не подсказать, чем
 * подсказать неверно: по такой подсказке человек не пойдёт за предметом.
 */

let data: Belongings | null = null;

export function setBelongings(b: Belongings | null): void {
  data = b;
}

export interface Have {
  /** в карманах */
  bag: number;
  /** в сундуках */
  chest: number;
  /** где лежит ближайший сундук */
  at?: string;
  /** растёт на грядке: сколько дней до ближайшего сбора */
  growing?: number;
  /** сколько грядок занято этой культурой */
  beds?: number;
}

/**
 * Качество: для узелка с золотым качеством обычный предмет из сундука
 * не подходит. Золото — 2, серебро — 1, обычное — 0.
 */
function qualityOk(it: Item, q: number): boolean {
  return it.gold ? q >= 2 : true;
}

const where = (h: HeldItem): string => {
  const ru = LOC_RU[h.loc ?? ''] ?? h.loc ?? '';
  return ru + (h.x !== undefined && h.x >= 0 ? ' (' + h.x + ', ' + h.y + ')' : '');
};

export function have(it: Item): Have | null {
  if (!data) return null;
  const id = ITEM_IDS[it.id];
  if (!id) return null;

  let bag = 0, chest = 0, at: string | undefined;
  for (const h of data.items) {
    if (h.id !== id || !qualityOk(it, h.quality)) continue;
    if (h.where === 'bag') bag += h.qty;
    else {
      chest += h.qty;
      if (!at) at = where(h);
    }
  }

  const beds: GrowingCrop[] = data.crops.filter((c) => c.id === id);
  const growing = beds.length
    ? beds.reduce((a, c) => Math.min(a, c.days), Infinity)
    : undefined;

  if (!bag && !chest && !beds.length) return null;
  return { bag, chest, at, growing, beds: beds.length || undefined };
}

/** Нужное количество с учётом ×N в узелке. */
export function enough(it: Item, h: Have): boolean {
  return h.bag + h.chest >= (it.q || 1);
}

/** Короткая подпись для строки предмета. */
export function haveText(it: Item, h: Have): string {
  const need = it.q || 1;
  const total = h.bag + h.chest;
  if (total >= need) {
    if (h.bag >= need) return 'уже в карманах' + (need > 1 ? ' ×' + need : '') + ' — просто сдай';
    return 'лежит в сундуке: ' + (h.at || 'где-то у тебя') + (total > 1 ? ' ×' + total : '');
  }
  if (total) {
    const place = h.bag ? 'в карманах' : 'в сундуке: ' + (h.at || '');
    return 'есть ' + total + ' из ' + need + ' — ' + place;
  }
  return 'растёт на грядке' + (h.beds && h.beds > 1 ? ' (' + h.beds + ' шт.)' : '')
    + (h.growing === 0 ? ', можно собирать сегодня' : ', ' + h.growing + ' дн. до сбора');
}

/** Предмет, за которым идти не надо: он уже есть или дорастает. */
export function covered(it: Item): boolean {
  const h = have(it);
  return !!h && (enough(it, h) || h.growing !== undefined);
}

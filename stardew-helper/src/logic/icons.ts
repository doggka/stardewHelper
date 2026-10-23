import type { Item } from '../types';
import { ITEM_IDS } from '../data/itemIds';

/**
 * Иконки предметов из игры. Их выгружает мод, поэтому их может не быть —
 * и это нормально: без картинок приложение работает так же, слот просто
 * показывает название. Иконки улучшают, а не включают.
 */

let icons: Record<string, string> = {};

export function setIcons(map: Record<string, string> | null): void {
  icons = map ?? {};
}

export function hasIcons(): boolean {
  return Object.keys(icons).length > 0;
}

/** data-URL картинки предмета либо null, если её нет. */
export function iconFor(it: Item): string | null {
  const id = ITEM_IDS[it.id];
  if (!id) return null;
  // мод пишет файлы с заменой небуквенных символов, повторяем ту же замену
  return icons[id.replace(/[^A-Za-zА-Яа-я0-9]/g, '_')] ?? icons[id] ?? null;
}

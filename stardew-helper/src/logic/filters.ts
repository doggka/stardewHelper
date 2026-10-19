import type { Item } from '../types';
import { S } from '../state';
import { done, hasLoc } from './status';

/**
 * Фильтра по статусу здесь больше нет: ряд чипов наверху дублировал блок
 * «Сегодня» и подсветку строк, а по нажатию скрывал содержимое, вплоть
 * до пропажи комнат целиком. Остались два фильтра, которые включаются
 * осознанно и видны на экране.
 */
export function filterActive(): boolean {
  return S.hideDone || !!S.locFilter;
}

export function visible(it: Item): boolean {
  if (S.hideDone && done(it)) return false;
  if (S.locFilter && !hasLoc(it, S.locFilter)) return false;
  return true;
}

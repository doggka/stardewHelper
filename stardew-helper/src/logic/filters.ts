import type { Item } from '../types';
import { LVL_ORDER } from '../data/constants';
import { ALL, S } from '../state';
import { bprog, done, hasLoc, st } from './status';

/** «last» — не отдельный уровень, а флаг; для фильтра разбираем отдельно. */
export function lvlOf(it: Item): string[] {
  const s = st(it);
  return s.last ? ['last', s.lvl] : [s.lvl];
}

export function filterActive(): boolean {
  return S.filters.length > 0 || S.hideDone || !!S.locFilter;
}

export function visible(it: Item): boolean {
  if (S.hideDone && done(it)) return false;
  if (S.locFilter && !hasLoc(it, S.locFilter)) return false;
  if (!S.filters.length) return true;
  const ls = lvlOf(it);
  return S.filters.some((f) => ls.indexOf(f) >= 0);
}

export function countsByLvl(): Record<string, number> {
  const c: Record<string, number> = {};
  LVL_ORDER.forEach((k) => (c[k] = 0));
  ALL.forEach((it) => {
    if (it.bundle.room.extra || done(it) || bprog(it.bundle).ok) return;
    lvlOf(it).forEach((k) => {
      if (c[k] !== undefined) c[k]++;
    });
  });
  return c;
}

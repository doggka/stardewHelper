import type { Bundle, CartInfo, Item, Status } from '../types';
import { LOC } from '../data/locations';
import { CART, CART_QUALITY, NEVER } from '../data/cart';
import { SEASON_FROM, SP, WI } from '../data/constants';
import { ALL, ROOMS, S, progress } from '../state';

/* ===================== ТОРГОВКА ===================== */

export function cartInfo(it: Item): CartInfo {
  if (it.gold) return { no: CART_QUALITY };
  if (it.noCart) return { no: CART_QUALITY };
  if (NEVER[it.n]) return { no: NEVER[it.n] };
  const p = CART[it.n];
  return p ? { price: p } : { no: 'нет в ассортименте торговки' };
}

export const dow = (d: number) => (d - 1) % 7;

export function cartToday(): string | null {
  const d = S.day, w = dow(d);
  if (S.season === WI && d >= 15 && d <= 17) return 'Ночной рынок — торговка на пляже 17:00–02:00';
  if (S.season === SP && d >= 15 && d <= 17) return 'Пустынный фестиваль — торговка там же 12:00–02:00';
  if (w === 4 || w === 6) return 'Торговка в Пепельносмольном лесу, 06:00–20:00';
  return null;
}

export function nextCart(): number | null {
  for (let d = S.day + 1; d <= 28; d++) {
    const w = (d - 1) % 7;
    if (w === 4 || w === 6) return d - S.day;
    if (S.season === WI && d >= 15 && d <= 17) return d - S.day;
    if (S.season === SP && d >= 15 && d <= 17) return d - S.day;
  }
  return null;
}

/* ===================== СТАТУС =====================
   locS — переопределение локации на конкретный сезон.
   Например у шампиньона весной источник только тайный лес, а осенью — где угодно. */

export function effLoc(it: Item): string | null {
  if (it.locS && it.locS[S.season] !== undefined) return it.locS[S.season];
  return it.loc || null;
}

export function hasLoc(it: Item, key: string): boolean {
  if (it.loc === key) return true;
  if (it.locS) for (const k in it.locS) if (it.locS[k] === key) return true;
  return false;
}

export function st(it: Item): Status {
  const cur = +S.season, cond: string[] = [];
  if (it.w && it.w !== S.weather) cond.push(it.w === 'rain' ? 'нужен дождь' : 'нужна ясная погода');
  if (it.t) cond.push(it.t);
  if (it.c) cond.push(it.c);
  const el = effLoc(it);
  const gated = el && LOC[el] && LOC[el].gate;
  const hard = !!((it.w && it.w !== S.weather) || !!it.c || !!gated);
  if (!it.s) return { lvl: hard || cond.length ? 'cond' : 'now', cond, last: false, hard };
  const inS = it.s.indexOf(cur as never) >= 0;
  const later = it.s.some((x) => x > cur);
  if (inS) return { lvl: hard ? 'cond' : cond.length ? 'cond' : 'now', cond, last: !later, hard };
  if (later) {
    const nx = Math.min.apply(null, it.s.filter((x) => x > cur) as number[]);
    return { lvl: 'later', cond: [SEASON_FROM[nx]].concat(cond), last: false, hard: true };
  }
  if (it.alsoAny) return { lvl: 'cond', cond: ['вне сезона — только альтернативный источник'].concat(cond), last: false, hard: true };
  const ci = cartInfo(it);
  if (ci.price) return { lvl: 'cart', cond: ['вне сезона — только у торговки, ' + ci.price + ' з.'].concat(cond), last: false, hard: true };
  return { lvl: 'past', cond: [ci.no!].concat(cond), last: false, hard: true };
}

/* ===================== ПРОГРЕСС ===================== */

export const done = (it: Item): boolean => !!progress().checked[it.id];

export function setDone(id: string, on: boolean): void {
  const p = progress();
  if (on) p.checked[id] = 1;
  else delete p.checked[id];
}

export function bprog(b: Bundle): { c: number; n: number; ok: boolean } {
  const ch = progress().checked;
  if (!b.items) return { c: ch[b.id] ? 1 : 0, n: 1, ok: !!ch[b.id] };
  const c = b.items.filter(done).length;
  return { c: Math.min(c, b.slots), n: b.slots, ok: c >= b.slots };
}

export function totals(): { ok: number; n: number } {
  let ok = 0, n = 0;
  ROOMS.forEach((r) => {
    if (r.extra) return;
    r.bundles.forEach((b) => {
      n++;
      if (bprog(b).ok) ok++;
    });
  });
  return { ok, n };
}

export { ALL };

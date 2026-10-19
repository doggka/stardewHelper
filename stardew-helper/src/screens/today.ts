import type { BridgeState, Item } from '../types';
import { DOW, SEASON_KEY, SEASON_RU } from '../data/constants';
import { ALL, S } from '../state';
import { bprog, cartToday, dow, done, nextCart, st } from '../logic/status';
import { norm } from '../logic/search';
import { esc, flat } from '../ui/html';

/**
 * Блок «Сегодня» — вместо вкладок «Не продолбать» и «Доступно сейчас».
 * Всё это и раньше считалось, просто было разнесено по разным экранам.
 */

/** Последний день, когда культуру ещё имеет смысл сажать в текущем сезоне. */
export function lastPlantDay(it: Item): number | null {
  if (!it.grow || !it.s) return null;
  if (it.s.indexOf(S.season) < 0) return null;
  return 28 - it.grow;
}

/** Культуры, которые ещё не сданы и вот-вот перестанут успевать вырасти. */
export function urgentCrops(): { it: Item; last: number; left: number }[] {
  const out: { it: Item; last: number; left: number }[] = [];
  ALL.forEach((it) => {
    if (it.bundle.room.extra || done(it) || bprog(it.bundle).ok) return;
    const last = lastPlantDay(it);
    if (last === null) return;
    const left = last - S.day;
    if (left < 0 || left > 5) return; // показываем только когда уже горит
    out.push({ it, last, left });
  });
  return out.sort((a, b) => a.left - b.left);
}

/** Что ловится прямо сейчас: сезон, погода и время уже учтены в статусе. */
function biting(): Item[] {
  return ALL.filter((it) => {
    if (it.bundle.room.extra || done(it) || bprog(it.bundle).ok) return false;
    if (!it.t && !/[Лл]овится|[Оо]кеан|[Рр]ек/.test(it.src || '')) return false;
    return st(it).lvl === 'now' || (st(it).lvl === 'cond' && !it.c);
  });
}

/** Последнее, что отдал мод-мостик. Обновляется при возврате фокуса в окно. */
let bridgeState: BridgeState | null = null;
export function setBridgeState(s: BridgeState | null): void {
  bridgeState = s;
}

/**
 * Строка про торговку. Мод отдаёт просто список товаров — что из них важно,
 * решаем здесь: мод не знает ни состава узелков, ни что уже отмечено,
 * ни наших предупреждений.
 */
function cartRow(today: string | null, nx: number | null): string {
  const b = bridgeState;
  const live = b && b.cartPresent && b.day === S.day && b.season === SEASON_KEY[S.season];

  if (!live) {
    return '<div class="trow"><span class="tico">🛒</span><div>'
      + '<b>' + (today ? 'Торговка здесь' : nx !== null ? 'Торговка через ' + nx + ' дн.' : 'В этом сезоне торговки больше нет') + '</b>'
      + '<span class="tsub">' + (today ? esc(today) : 'пятница и воскресенье, 06:00–20:00') + '</span>'
      + '</div><button data-act="cartInfo">Что брать</button></div>';
  }

  // сверяем её товары с тем, что нам ещё нужно
  const needed: { name: string; price: number; item: Item }[] = [];
  for (const good of b!.cart) {
    const key = norm(good.name);
    const it = ALL.find((x) => norm(x.n) === key && !x.bundle.room.extra
      && !done(x) && !bprog(x.bundle).ok);
    if (it) needed.push({ name: good.name, price: good.price, item: it });
  }

  if (!needed.length) {
    return '<div class="trow"><span class="tico">🛒</span><div>'
      + '<b>Торговка здесь, но ничего нужного нет</b>'
      + '<span class="tsub">проверено по её сегодняшнему ассортименту — '
      + b!.cart.length + ' позиций, для узелков ни одной</span>'
      + '</div><button data-act="cartInfo">Показать список</button></div>';
  }

  // сверху то, о чём у нас есть предупреждение, потом «последний сезон»
  needed.sort((x, y) => (x.item.warn ? 0 : 1) - (y.item.warn ? 0 : 1)
    || (st(y.item).last ? 1 : 0) - (st(x.item).last ? 1 : 0));
  const top = needed[0];

  return '<div class="trow urgent"><span class="tico">🛒</span><div>'
    + '<b>Торговка здесь: ' + esc(top.name) + ', ' + top.price + ' з.</b>'
    + '<span class="tsub">'
    + (top.item.warn ? 'бери обязательно — ' + stripTags(top.item.warn)
       : st(top.item).last ? 'нужен для «' + esc(top.item.bundle.name) + '», сезон последний'
       : 'нужен для «' + esc(top.item.bundle.name) + '»')
    + (needed.length > 1 ? ' · ещё нужного: ' + needed.slice(1).map((n) => esc(n.name)).join(', ') : '')
    + '</span></div><button data-act="cartInfo">Весь список</button></div>';
}

/** В подписи нужен простой текст: предупреждения хранятся с разметкой. */
function stripTags(s: string): string {
  return esc(s.replace(/<[^>]+>/g, ''));
}

export function todayHTML(): string {
  const today = cartToday(), nx = nextCart();
  const rows: string[] = [];

  // 1. Что закрывается в этом сезоне
  const closing = ALL.filter((it) => !it.bundle.room.extra && !done(it)
    && !bprog(it.bundle).ok && st(it).last);
  if (closing.length) {
    rows.push('<div class="trow urgent"><span class="tico">⏳</span><div>'
      + '<b>Закрывается этим сезоном: ' + closing.length + '</b>'
      + '<span class="tsub">дальше только торговка или следующий год</span>'
      + '</div><button data-act="filterLast">Показать</button></div>');
  }

  // 2. Культуры, которым вот-вот станет поздно
  const crops = urgentCrops();
  if (crops.length) {
    const c = crops[0];
    rows.push('<div class="trow' + (c.left <= 1 ? ' urgent' : '') + '"><span class="tico">🌱</span><div>'
      + '<b>' + esc(c.it.n) + (c.left <= 0 ? ' — сажай сегодня' : ' — осталось ' + c.left + ' дн. на посадку') + '</b>'
      + '<span class="tsub">растёт ' + c.it.grow + ' дней, крайний день посадки — ' + c.last + ' '
      + SEASON_RU[S.season].toLowerCase()
      + (crops.length > 1 ? '. Ещё ' + (crops.length - 1) + ' на подходе' : '') + '</span>'
      + '</div></div>');
  }

  // 3. Рыба и прочее, что доступно именно сейчас
  const now = biting();
  if (now.length) {
    rows.push('<div class="trow"><span class="tico">🎣</span><div>'
      + '<b>Клюёт сейчас: ' + now.slice(0, 3).map((i) => esc(i.n)).join(', ')
      + (now.length > 3 ? ' и ещё ' + (now.length - 3) : '') + '</b>'
      + '<span class="tsub">' + esc(now[0].t || 'в это время суток') + ' · '
      + (S.weather === 'rain' ? 'дождь' : 'ясно') + '</span>'
      + '</div><button data-act="filterNow">Показать</button></div>');
  }

  // 4. Торговка. Если мод-мостик отдал список — разбираем его по нашим данным
  rows.push(cartRow(today, nx));

  return '<div class="today">'
    + '<div class="thead">' + DOW[dow(S.day)] + ', ' + S.day + ' ' + SEASON_RU[S.season].toLowerCase()
    + ', ' + (S.weather === 'rain' ? 'дождь' : 'ясно') + '</div>'
    + rows.join('') + '</div>';
}

export { flat };

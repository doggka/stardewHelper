import type { BridgeState, Item } from '../types';
import { DOW, SEASON_KEY, SEASON_RU } from '../data/constants';
import { ALL, S } from '../state';
import { bprog, cartToday, dow, done, nextCart, st } from '../logic/status';
import { norm } from '../logic/search';
import { covered } from '../logic/have';
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
    // уже растёт на грядке или лежит в сундуке — сажать нечего
    if (covered(it)) return;
    const last = lastPlantDay(it);
    if (last === null) return;
    const left = last - S.day;
    if (left < 0 || left > 5) return; // показываем только когда уже горит
    out.push({ it, last, left });
  });
  return out.sort((a, b) => a.left - b.left);
}

/**
 * Что реально можно добыть сегодня: сезон и погода уже совпали, осталось
 * максимум попасть во время суток. Тот же критерий, по которому строка
 * предмета подсвечивается в комнатах — иначе блок и комнаты расходились бы
 * в советах.
 */
function availableToday(): Item[] {
  return ALL.filter((it) => {
    if (it.bundle.room.extra || done(it) || bprog(it.bundle).ok) return false;
    const s = st(it);
    return s.lvl === 'now' || (s.lvl === 'cond' && !s.hard);
  });
}

/**
 * Рыба — это комната Аквариума, а не слова «ловится» и «океан» в описании,
 * как было раньше. Описание пишется для человека, опираться на него нельзя.
 */
const isFish = (it: Item): boolean => it.bundle.room.id === 'fishtank';

/** Последнее, что отдал мод-мостик. Обновляется при возврате фокуса в окно. */
let bridgeState: BridgeState | null = null;

/**
 * Игровой день, погоду которого мы уже перенесли из игры.
 *
 * Нужен, чтобы не затирать ручной выбор ☀/☔ на каждом обновлении: кнопки
 * остаются для «а что если», и переключённое руками должно держаться до
 * конца дня. А вот новый день приносит новую погоду, и вот тогда забираем.
 */
let weatherDay = '';

export function setBridgeState(s: BridgeState | null): void {
  bridgeState = s;
  if (!s) return;
  const key = s.year + '|' + s.season + '|' + s.day;
  const sameDate = s.day === S.day && s.season === SEASON_KEY[S.season];
  if (key !== weatherDay && sameDate) {
    weatherDay = key;
    if (s.weather === 'sun' || s.weather === 'rain') S.weather = s.weather;
  }
}

/**
 * Строка про торговку. Мод отдаёт просто список товаров — что из них важно,
 * решаем здесь: мод не знает ни состава узелков, ни что уже отмечено,
 * ни наших предупреждений.
 */
function cartRow(today: string | null, nx: number | null): string {
  const b = bridgeState;
  // год тоже сравниваем: без него 1 осени 1-го года совпало бы со 2-м
  const fresh = !!b && b.day === S.day && b.season === SEASON_KEY[S.season]
    && (!S.save || b.year === S.save.year);
  // Календарь — вторая независимая проверка. Мод уже один раз сообщил
  // о торговке в понедельник; молча выбрать одну из двух версий значит
  // спрятать ошибку, поэтому при расхождении говорим об этом вслух.
  const conflict = fresh && !!b!.cartPresent && !today;
  const live = fresh && b!.cartPresent && !!today;

  if (!live) {
    return '<div class="trow"><span class="tico">🛒</span><div>'
      + '<b>' + (today ? 'Торговка здесь' : nx !== null ? 'Торговка через ' + nx + ' дн.' : 'В этом сезоне торговки больше нет') + '</b>'
      + '<span class="tsub">'
      + (conflict
          ? 'мод сообщил о торговке, но по календарю сегодня '
            + DOW[dow(S.day)].toLowerCase() + ' — верю календарю'
          : today ? esc(today) : 'пятница и воскресенье, 06:00–20:00')
      + '</span>'
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

/**
 * Строка со списком, который раскрывается на месте.
 *
 * Раньше кнопка ставила глобальный фильтр по статусу: комнаты ниже
 * прореживались, часть из них пропадала целиком, и чтобы вернуться, надо
 * было найти «сбросить фильтр». Теперь список открывается прямо здесь —
 * ровно тот набор, который посчитан в заголовке.
 */
function expandable(key: string, cls: string, ico: string, head: string, sub: string, items: Item[], opts: { lastIsImplied?: boolean } = {}): string {
  const open = S.todayOpen.indexOf(key) >= 0;
  return '<div class="trow' + (cls ? ' ' + cls : '') + (open ? ' open' : '') + '">'
    + '<span class="tico">' + ico + '</span><div>'
    + '<b>' + head + '</b><span class="tsub">' + sub + '</span></div>'
    + '<button data-today="' + key + '" aria-expanded="' + open + '">'
    + (open ? 'Свернуть' : 'Показать') + '</button>'
    + (open ? '<div class="tlist">' + flat(items, opts) + '</div>' : '')
    + '</div>';
}

export function todayHTML(): string {
  const today = cartToday(), nx = nextCart();
  const rows: string[] = [];
  const avail = availableToday();

  // 0. Рыбалка — единственный пункт про «идти или не идти», остальные про
  //    «не забудь». Поэтому первой и отдельно.
  const fish = avail.filter(isFish);
  let head = '';
  if (fish.length) {
    const lastOnes = fish.filter((i) => st(i).last);
    head = '<div class="tfish">' + expandable('fish', lastOnes.length ? 'urgent' : '', '🎣',
      'Рыбалка сегодня: ' + fish.length
      + (lastOnes.length ? ', из них ' + lastOnes.length + ' в последний сезон' : ''),
      lastOnes.length
        ? 'идти стоит: ' + lastOnes.slice(0, 3).map((i) => esc(i.n)).join(', ')
          + ' иначе в этом году уже не достать'
        : 'ничего не горит — можно и не ходить, всё ловится и дальше',
      fish) + '</div>';
  }

  // 1. Что закрывается в этом сезоне. Предметы, которые уже лежат дома
  //    или дорастают, из счётчика уходят: за ними идти не надо.
  const closingAll = ALL.filter((it) => !it.bundle.room.extra && !done(it)
    && !bprog(it.bundle).ok && st(it).last);
  const closing = closingAll.filter((it) => !covered(it));
  const already = closingAll.length - closing.length;
  if (closingAll.length) {
    rows.push(expandable('last', closing.length ? 'urgent' : '', '⏳',
      closing.length
        ? 'Закрывается этим сезоном: ' + closing.length
          + (already ? ' (ещё ' + already + ' уже есть)' : '')
        : 'Закрывается этим сезоном: всё ' + already + ' уже есть у тебя',
      closing.length
        ? 'дальше только торговка или следующий год'
        : 'осталось донести до центра',
      closingAll, { lastIsImplied: true }));
  }

  // 2. Культуры, которым вот-вот станет поздно
  const crops = urgentCrops();
  if (crops.length) {
    const c = crops[0];
    rows.push(expandable('crops', c.left <= 1 ? 'urgent' : '', '🌱',
      esc(c.it.n) + (c.left <= 0 ? ' — сажай сегодня' : ' — осталось ' + c.left + ' дн. на посадку'),
      'растёт ' + c.it.grow + ' дней, крайний день посадки — ' + c.last + ' '
      + SEASON_RU[S.season].toLowerCase()
      + (crops.length > 1 ? '. Ещё ' + (crops.length - 1) + ' на подходе' : ''),
      crops.map((x) => x.it)));
  }

  // 3. Всё остальное, что доступно именно сейчас.
  //    Без рыбы (она выше), без того, что уже есть, и без вещей вне
  //    сезонов: древесина и камень доступны каждый день весь год —
  //    новостью они быть не могут.
  const other = avail.filter((i) => !isFish(i) && i.s && !covered(i));
  if (other.length) {
    // одинаковые названия из разных узелков схлопываем: «Древесина,
    // Древесина, Камень» — это не три дела, а два
    const names: string[] = [];
    other.forEach((i) => { if (names.indexOf(i.n) < 0) names.push(i.n); });
    rows.push(expandable('now', '', '🧺',
      'Можно взять сейчас: ' + names.slice(0, 3).map(esc).join(', ')
      + (names.length > 3 ? ' и ещё ' + (names.length - 3) : ''),
      'сезон и погода подходят' + (S.weather === 'rain' ? ' · дождь' : ''),
      other));
  }

  // 5. Торговка. Если мод-мостик отдал список — разбираем его по нашим данным
  rows.push(cartRow(today, nx));

  return head
    + '<div class="today">'
    + '<div class="thead">' + DOW[dow(S.day)] + ', ' + S.day + ' ' + SEASON_RU[S.season].toLowerCase()
    + ', ' + (S.weather === 'rain' ? 'дождь' : 'ясно') + '</div>'
    + rows.join('') + '</div>';
}

export { flat };

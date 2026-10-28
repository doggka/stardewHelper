import type { BridgeState, HeldItem, Item, SaveSummary } from '../types';
import { DOW, SEASON_GEN, SEASON_KEY, SEASON_RU } from '../data/constants';
import { FAIR_SHOP, FESTIVAL_COMMON, nextFestival } from '../data/festivals';
import { ITEM_IDS } from '../data/itemIds';
import { GRANGE_CATS, itemPoints, pickGrange, sellPrice } from '../logic/grange';
import { ALL, S } from '../state';
import { bprog, cartToday, dow, done, nextCart, st } from '../logic/status';
import { norm } from '../logic/search';
import { belongings, covered } from '../logic/have';
import { GUIDES } from '../data/guides';
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

/**
 * Культуры, которые ещё не сданы и которые надо посадить.
 *
 * Раньше показывались только когда до крайнего дня оставалось ≤5 дней.
 * Из-за этого пшеница (растёт 4 дня, крайний день 24-й) молчала весь
 * сезон, а потом всплывала в «можно взять сейчас» — где ей вообще
 * не место. Теперь показываем весь сезон, но по-разному: спокойно,
 * пока есть запас, и настойчиво, когда срок близко.
 */
export function urgentCrops(): { it: Item; last: number; left: number }[] {
  const out: { it: Item; last: number; left: number }[] = [];
  ALL.forEach((it) => {
    if (it.bundle.room.extra || done(it) || bprog(it.bundle).ok) return;
    // уже растёт на грядке или лежит в сундуке — сажать нечего
    if (covered(it)) return;
    const last = lastPlantDay(it);
    if (last === null) return;
    const left = last - S.day;
    if (left < 0) return; // сажать уже поздно, об этом говорит другая строка
    out.push({ it, last, left });
  });
  return out.sort((a, b) => a.left - b.left);
}

/**
 * Что реально можно добыть сегодня: пойти и взять.
 *
 * Культуры сюда не входят. Их нельзя «взять сейчас» — их сажают и ждут,
 * и погода им безразлична. Раньше сюда попадали все 20 культур, как
 * только совпадал сезон, и получалось «Можно взять сейчас: Пшеница ·
 * сезон и погода подходят», хотя пшеница даже не посажена.
 */
function availableToday(): Item[] {
  return ALL.filter((it) => {
    if (it.bundle.room.extra || done(it) || bprog(it.bundle).ok) return false;
    if (it.grow) return false;
    const s = st(it);
    return s.lvl === 'now' || (s.lvl === 'cond' && !s.hard);
  });
}

/**
 * Предметы, которые ловятся только в дождь. Их во всей игре пять, и все —
 * рыба: Сом, Шэд, Берикс, Жёлтый судак, Угорь. Поэтому дождливый день
 * и есть главная причина бросить дела и пойти на речку.
 */
function rainOnly(): Item[] {
  return ALL.filter((it) => it.w === 'rain' && !it.bundle.room.extra
    && !done(it) && !bprog(it.bundle).ok && !covered(it)
    && (!it.s || it.s.indexOf(S.season) >= 0));
}

/**
 * Рыба — это комната Аквариума, а не слова «ловится» и «океан» в описании,
 * как было раньше. Описание пишется для человека, опираться на него нельзя.
 */
const isFish = (it: Item): boolean => it.bundle.room.id === 'fishtank';

/** Последнее, что отдал мод-мостик. Обновляется при возврате фокуса в окно. */
let bridgeState: BridgeState | null = null;

/** Данные про сегодня годятся, только если это и правда сегодня. */
function liveBridge(): BridgeState | null {
  const b = bridgeState;
  if (!b) return null;
  const same = b.day === S.day && b.season === SEASON_KEY[S.season]
    && (!S.save || b.year === S.save.year);
  return same ? b : null;
}

/**
 * Сейв как запасной источник удачи и завтрашней погоды, когда мода нет.
 * Годится, только если показанная дата совпадает с сохранённой: иначе его
 * сводка не про тот день, который на экране.
 */
function liveSave(): SaveSummary | null {
  const s = S.save;
  if (!s) return null;
  return s.day === S.day && s.season === S.season ? s : null;
}

/**
 * Удача дня словами, а не числом: в игре это говорят духи по телевизору,
 * и цифра −0.07 никому ничего не объясняет. Пороги взяты по тому, как
 * игра сама делит диапазон −0.1…0.1 на фразы.
 */
function luckLine(): string {
  const b = liveBridge();
  const v = b && typeof b.luck === 'number' ? b.luck : liveSave()?.luck;
  if (v === undefined || v === null) return '';
  const txt = v <= -0.07 ? 'духи недовольны — день неудачный'
    : v < -0.02 ? 'духи ворчат — удача ниже обычного'
    : v <= 0.02 ? 'духи спокойны — обычный день'
    : v < 0.07 ? 'духи в хорошем настроении'
    : 'духи очень довольны — лучший день для шахты и рыбалки';
  return ' · <span class="tluck">' + txt + '</span>';
}

function tomorrowLine(): string {
  const b = liveBridge();
  const known = (b && b.weatherTomorrow) || liveSave();
  if (!known) return '';
  return ' · завтра ' + (tomorrowRain() ? 'дождь' : 'ясно');
}

function tomorrowRain(): boolean {
  const b = liveBridge();
  if (b && b.weatherTomorrow) {
    return /^(Rain|Storm|GreenRain)$/.test(b.weatherTomorrow);
  }
  return liveSave()?.weatherTomorrow === 'rain';
}

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

/**
 * Удачный день — повод спуститься в Пещеру Черепа: удача повышает там
 * частоту лестниц и шахт. Показываем только когда удача и правда высокая,
 * иначе строка превратится в фон и её перестанут читать.
 */
function skullRow(): string {
  const b = liveBridge();
  const v = b && typeof b.luck === 'number' ? b.luck : liveSave()?.luck;
  if (v === undefined || v === null || v < 0.07) return '';

  const kit = GUIDES[0].kit ?? [];
  const bel = belongings();
  const missing = bel
    ? kit.filter((k) => !bel.items.some((i) => i.name === k.name)).map((k) => k.ru)
    : [];

  return '<div class="trow urgent"><span class="tico">💀</span><div>'
    + '<b>Духи довольны — день для Пещеры Черепа</b>'
    + '<span class="tsub">'
    + (missing.length
        ? 'в сундуках не нашлось: ' + esc(missing.join(', '))
        : 'снаряжение на месте — лестницы, бомбы, еда, тотем')
    + '</span></div>'
    + '<button data-t="guide">Как идти</button></div>';
}

/**
 * Строка фестиваля. Показываем за неделю: раньше — шум, позже — поздно
 * готовиться. У ярмарки раскрывается подбор девятки на выставку.
 */
function festivalRow(): string {
  const nf = nextFestival(S.season, S.day);
  if (!nf || nf.inDays > 7) return '';
  const { f, inDays } = nf;

  const when = inDays === 0 ? 'сегодня'
    : inDays === 1 ? 'завтра'
    : 'через ' + inDays + ' дн.';
  const isFair = f.season === 2 && f.day === 16;
  const g = isFair ? pickGrange() : null;
  const open = S.todayOpen.indexOf('fair') >= 0;

  const sub = g
    ? 'по тому, что у тебя есть, выходит на ' + esc(g.place) + ' — расчёт пока не сверен с игрой'
    : esc(f.where + ', ' + f.time) + (f.prep ? ' · ' + esc(f.prep) : '');

  let body = '';
  if (g) {
    body += '<ul class="flat">'
      + g.picks.map((p) => '<li class="granged">'
        + '<span class="gname">' + esc(itemName(p)) + qualityTag(p.quality) + '</span>'
        + '<span class="gcat">' + esc(catName(p)) + '</span>'
        + '<span class="gprice">' + sellPrice(p) + ' з.</span>'
        + '<span class="gpts">' + itemPoints(p) + '</span></li>').join('')
      + '</ul>'
      + '<p class="note">Категорий представлено: ' + g.cats + ' из 8, больше шести очков не добавляют. '
      + 'Забери предметы с прилавка после судейства — сами они не вернутся, '
      + 'забытое уходит в бюро находок к мэру.</p>';
  }

  if (f.what && f.what.length) {
    body += '<p class="fsub">Что там будет</p><ul class="note notelist">'
      + f.what.map((w) => '<li>' + esc(w) + '</li>').join('') + '</ul>';
  }

  // Магазин за жетоны: главное число — 2000 за каплю при 1000 за первое
  // место. Понять это надо до ярмарки, а не стоя у прилавка.
  if (isFair) {
    body += '<p class="fsub">На что тратить жетоны</p><ul class="flat">'
      + FAIR_SHOP.map((p) => '<li class="granged">'
        + '<span class="gname">' + esc(p.name) + '</span>'
        + '<span class="gcat">' + esc(p.note ?? '') + '</span>'
        + '<span class="gpts">' + p.cost + '</span></li>').join('')
      + '</ul>'
      + '<p class="note">Каждый товар — один раз в год, жетоны на следующий год '
      + 'не переносятся. Первое место даёт 1000, а капля стоит 2000: одной выставки '
      + 'не хватит, добирай на мини-играх.</p>';
  }

  // Накануне напоминаем про закрытые магазины и съеденный день.
  if (inDays <= 1) {
    body += '<ul class="note notelist">'
      + FESTIVAL_COMMON.map((w) => '<li>' + esc(w) + '</li>').join('') + '</ul>';
  }

  const urgent = inDays <= 1 ? ' urgent' : '';
  if (!body) {
    return '<div class="trow' + urgent + '"><span class="tico">🎪</span><div>'
      + '<b>' + esc(f.name) + ' — ' + when + '</b>'
      + '<span class="tsub">' + sub + '</span></div></div>';
  }

  return '<div class="trow' + urgent + (open ? ' open' : '') + '">'
    + '<span class="tico">🎪</span><div>'
    + '<b>' + esc(f.name) + ' — ' + when + '</b>'
    + '<span class="tsub">' + sub + '</span></div>'
    + '<button data-today="fair" aria-expanded="' + open + '">'
    + (open ? 'Свернуть' : g ? 'Что нести' : 'Подробности') + '</button>'
    + (open ? '<div class="tlist">' + body + '</div>' : '')
    + '</div>';
}

/** Русское название, если знаем; иначе внутриигровое английское. */
function itemName(h: HeldItem): string {
  const our = ALL.find((it) => ITEM_IDS[it.id] === h.id);
  return our ? our.n : h.name;
}

const qualityTag = (q: number): string =>
  q === 4 ? ' (иридий)' : q === 2 ? ' (золото)' : q === 1 ? ' (серебро)' : '';

const catName = (h: HeldItem): string =>
  GRANGE_CATS.find((c) => c.cats.indexOf(h.cat) >= 0)?.name ?? 'вне категорий';

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
  //
  //    Считаем не количество, а погоду. Дождевых предметов в игре пять,
  //    и все — рыба; в ясный день их не поймать вовсе. Поэтому дождь —
  //    это повод бросить дела, а ясная погода поводом быть не может,
  //    сколько бы рыбы ни клевало.
  const fish = avail.filter(isFish);
  const rain = rainOnly();
  const wetToday = S.weather === 'rain';
  let head = '';
  if (wetToday && rain.length) {
    head = '<div class="tfish">' + expandable('fish', 'urgent', '🌧',
      'Сегодня дождь — лови: ' + rain.slice(0, 3).map((i) => esc(i.n)).join(', ')
      + (rain.length > 3 ? ' и ещё ' + (rain.length - 3) : ''),
      'только в дождь и никак иначе; дожди редкие, следующего можно ждать долго',
      rain) + '</div>';
  } else if (!wetToday && tomorrowRain() && rain.length) {
    head = '<div class="tfish">' + expandable('fish', '', '🌧',
      'Завтра дождь — будет шанс на ' + rain.slice(0, 3).map((i) => esc(i.n)).join(', ')
      + (rain.length > 3 ? ' и ещё ' + (rain.length - 3) : ''),
      'приготовь удочку и наживку, в ясную погоду их не поймать',
      rain) + '</div>';
  } else if (fish.length) {
    const lastOnes = fish.filter((i) => st(i).last);
    head = '<div class="tfish">' + expandable('fish', lastOnes.length ? 'urgent' : '', '🎣',
      lastOnes.length
        ? 'Последний сезон: ' + lastOnes.slice(0, 3).map((i) => esc(i.n)).join(', ')
        : 'Клюёт сегодня: ' + fish.length,
      lastOnes.length
        ? 'в этом году другого случая не будет'
        : 'спешки нет — эта рыба ловится и дальше',
      fish) + '</div>';
  }

  // 1. Что закрывается в этом сезоне. Предметы, которые уже лежат дома
  //    или дорастают, из счётчика уходят: за ними идти не надо.
  const closingAll = ALL.filter((it) => !it.bundle.room.extra && !done(it)
    && !bprog(it.bundle).ok && st(it).last);
  const closing = closingAll.filter((it) => !covered(it));
  const already = closingAll.length - closing.length;
  if (closingAll.length) {
    // Глагол вместо причастия и названия вместо чисел: «Закрывается этим
    // сезоном: 8 (ещё 3 уже есть)» читалось ребусом и не говорило, что делать.
    const names = closing.slice(0, 3).map((i) => esc(i.n)).join(', ');
    rows.push(expandable('last', closing.length ? 'urgent' : '', '⏳',
      closing.length
        ? 'Успеть до конца ' + SEASON_GEN[S.season] + ': ' + closing.length
        : 'До конца ' + SEASON_GEN[S.season] + ' всё успели',
      closing.length
        ? names + (closing.length > 3 ? ' и ещё ' + (closing.length - 3) : '')
          + ' — потом только у торговки или через год'
        : 'это уже у тебя, осталось донести до центра',
      closingAll, { lastIsImplied: true }));
  }

  // 2. Что посадить. Говорим весь сезон, но тон зависит от запаса:
  //    пока есть время — спокойно, ближе к сроку — настойчиво.
  const crops = urgentCrops();
  if (crops.length) {
    const c = crops[0];
    const soon = c.left <= 3;
    const lastYear = !!st(c.it).last;
    rows.push(expandable('crops', soon ? 'urgent' : '', '🌱',
      c.left <= 0
        ? 'Сажай сегодня: ' + esc(c.it.n) + ' — завтра уже не успеет'
        : 'Посади ' + esc(c.it.n) + ': осталось ' + c.left + ' дн.',
      'растёт ' + c.it.grow + ' дн., крайний день посадки — ' + c.last + ' '
      + SEASON_RU[S.season].toLowerCase()
      + (lastYear ? '. В этом году сезон для неё последний' : '')
      + (crops.length > 1 ? '. Всего ждут посадки: ' + crops.length : ''),
      crops.map((x) => x.it)));
  }

  // 3. Полив. Живое значение берём у мода: сейв переписывается только
  //    когда спишь, и его ответ устаревает, как только польёшь руками.
  const b = liveBridge();
  if (b && typeof b.needWater === 'number' && b.needWater > 0) {
    rows.push('<div class="trow"><span class="tico">💧</span><div>'
      + '<b>Полить: ' + b.needWater + ' гр.</b>'
      + '<span class="tsub">'
      + (tomorrowRain() ? 'завтра дождь — польёт само, но сегодня им ещё нужна вода'
         : 'без полива день роста пропадёт')
      + '</span></div></div>');
  }

  // 4. Сходить и собрать. Без рыбы (она выше), без культур (их сажают,
  //    а не берут), без того, что уже есть, и без вещей вне сезонов:
  //    древесина и камень доступны каждый день весь год — новостью они
  //    быть не могут.
  const other = avail.filter((i) => !isFish(i) && i.s && !covered(i));
  if (other.length) {
    // одинаковые названия из разных узелков схлопываем: «Древесина,
    // Древесина, Камень» — это не три дела, а два
    const names: string[] = [];
    other.forEach((i) => { if (names.indexOf(i.n) < 0) names.push(i.n); });
    rows.push(expandable('now', '', '🧺',
      'Сходить и собрать: ' + names.slice(0, 3).map(esc).join(', ')
      + (names.length > 3 ? ' и ещё ' + (names.length - 3) : ''),
      // про погоду пишем только когда она правда решает, а не всегда
      'сезон подходит',
      other));
  }

  // 4.5 Удачный день — повод идти в Пещеру Черепа. Удача там повышает
  //     частоту лестниц и шахт, то есть прямо ускоряет спуск. Это то,
  //     чего не скажет ни вики, ни поисковик: они не знают твой сейв.
  rows.push(skullRow());

  // 5. Фестиваль. Дата известна заранее, и готовиться надо заранее —
  //    поэтому предупреждаем за несколько дней, а не в то самое утро.
  rows.push(festivalRow());

  // 6. Торговка. Если мод-мостик отдал список — разбираем его по нашим данным
  rows.push(cartRow(today, nx));

  return head
    + '<div class="today">'
    + '<div class="thead">' + DOW[dow(S.day)] + ', ' + S.day + ' ' + SEASON_RU[S.season].toLowerCase()
    + ', ' + (S.weather === 'rain' ? 'дождь' : 'ясно')
    + luckLine() + tomorrowLine() + '</div>'
    + rows.join('') + '</div>';
}

export { flat };

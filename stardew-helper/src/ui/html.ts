import type { Bundle, Item, Room, Status } from '../types';
import { LVL, SEASON_RU, WIKI } from '../data/constants';
import { LOC } from '../data/locations';
import { ALL, S, progress } from '../state';
import { bprog, cartInfo, done, effLoc, hasLoc, st } from '../logic/status';
import { visible } from '../logic/filters';
import { enough, have, haveText } from '../logic/have';
import { needDone, needHint } from '../logic/farm';
import { iconFor } from '../logic/icons';

export const esc = (s: unknown): string =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

export const wikiUrl = (n: string): string => WIKI + encodeURIComponent(String(n).replace(/ /g, '_'));

export function locChips(it: Item): string {
  const key = effLoc(it);
  if (!key) return '';
  const L = LOC[key];
  if (!L) return '';
  // Кнопки, а не спаны: иначе до них не добраться с клавиатуры,
  // а скринридер читает их как обычный текст.
  return L.gate
    ? '<button type="button" class="b gate" data-loc="' + key + '"'
      + ' aria-label="Как попасть: ' + esc(L.n) + '">🔒 ' + esc(L.n) + ' · ' + esc(L.gate) + '</button>'
    : '<button type="button" class="b loc" data-loc="' + key + '"'
      + ' aria-label="Где это: ' + esc(L.n) + '">📍 ' + esc(L.n) + '</button>';
}

export interface ItemOpts {
  /** показать, к какому узелку относится предмет */
  showBundle?: boolean;
  /** панель сама про «последний сезон» — не дублируем бейдж на каждой строке */
  lastIsImplied?: boolean;
}

/**
 * Насколько строка должна бросаться в глаза.
 *
 * «hint-now» — в сезоне, условий нет: иди и возьми, но спешки нет.
 * «hint-window» — сезон и погода уже совпали, осталось попасть во время
 * суток. Это и есть «весна, дождь, ночь»: день подходящий, и второго
 * такого может не быть — красим заметнее.
 * Остальное (не та погода, закрытый доступ, другой сезон, торговка) не
 * красим вовсе: подсветка того, что сегодня всё равно не взять, только
 * мешает выбирать.
 */
function pickHint(s: Status): string {
  if (s.lvl === 'now') return 'hint-now' + (s.last ? ' hint-last' : '');
  if (s.lvl === 'cond' && !s.hard) return 'hint-window' + (s.last ? ' hint-last' : '');
  return '';
}

/** «Это у тебя уже есть» — отдельный бейдж, он важнее любого статуса. */
function haveHTML(it: Item): { badge: string; cls: string } {
  const h = have(it);
  if (!h) return { badge: '', cls: '' };
  const ready = enough(it, h);
  return {
    badge: '<span class="b ' + (ready ? 'got' : 'grow') + '">'
      + (ready ? '✓ ' : '🌱 ') + esc(haveText(it, h)) + '</span>',
    // за таким предметом идти не надо: подсветка «добудь сегодня» только мешает
    cls: ready ? 'hint-got' : 'hint-grow',
  };
}

export function itemHTML(it: Item, opts: ItemOpts = {}): string {
  const s = st(it), d = done(it), ci = cartInfo(it);
  const q = it.q ? ' <span class="qty">×' + it.q + '</span>' : '';
  const g = it.gold ? ' <span class="b g">золотое</span>' : '';
  const open = S.openSrc.indexOf(it.id) >= 0;

  const hv = d ? { badge: '', cls: '' } : haveHTML(it);

  let bd = hv.badge + '<span class="b ' + s.lvl + '">' + LVL[s.lvl] + '</span>';
  if (s.last && !d && !opts.lastIsImplied) {
    bd += '<span class="b last">⏳ последний сезон' + (ci.price ? ' · дальше торговка' : '') + '</span>';
  }
  bd += locChips(it);
  // Цепочку «постройка → животное → сердечки» показываем по состоянию фермы:
  // первый невыполненный шаг вместо всего списка. Если фермы мы не знаем,
  // остаётся прежний текст из данных.
  const nh = d ? null : needHint(it);
  s.cond.forEach((c) => {
    if (nh && c === it.c) return;
    bd += '<span class="b g">' + esc(c) + '</span>';
  });
  if (nh) bd += '<span class="b farm">🐄 ' + esc(nh) + '</span>';
  if (it.tree && !d) bd += '<span class="b g">дерево растёт 28 дней</span>';

  return '<div class="item' + (d ? ' ok' : '') + (open ? ' open' : '')
    + (d ? '' : ' ' + (hv.cls || pickHint(s))) + '" data-id="' + it.id + '">'
    // имя внутри label: кликабельна вся строка, а не квадрат 15px,
    // и скринридер наконец произносит, что именно он отмечает
    + '<div class="irow">'
    + '<label class="ipick">'
    + '<input type="checkbox" ' + (d ? 'checked' : '') + ' data-chk="' + it.id + '">'
    + '<span class="iname">' + esc(it.n) + q + g
    + (opts.showBundle ? ' <span class="tag">— ' + esc(it.bundle.name) + '</span>' : '')
    + '</span></label>'
    // кнопка «?» вне label — иначе клик по ней переключал бы галочку
    + '<button type="button" class="dot" data-src="' + it.id + '"'
    + ' aria-expanded="' + open + '" aria-label="Где добывать: ' + esc(it.n) + '">?</button>'
    + '</div>'
    + '<div class="ibody">'
    + '<div class="badges">' + bd + '</div>'
    + '<div class="src">' + esc(it.src || '')
    + '<br><a href="' + wikiUrl(it.n) + '" target="_blank" rel="noopener"'
    + ' aria-label="' + esc(it.n) + ' — статья на вики">статья на вики ↗</a></div>'
    // warnSetup нужен, только пока цепочка не собрана: «начинай копить
    // с весны» бессмысленно, когда хлев построен и свинья куплена
    + (!d && (it.warn || (it.warnSetup && !needDone(it)))
        ? '<div class="warn">⚠ ' + [it.warn, needDone(it) ? '' : it.warnSetup]
            .filter(Boolean).join(' ') + '</div>'
        : '')
    + '</div></div>';
}

/**
 * Заметка узелка списком, а не сплошным текстом.
 *
 * «Любые 3 из 4, золотое качество. У торговки не купишь — она продаёт
 * только обычное. Бери удобрение и качай фермерство заранее.» — это три
 * разные мысли подряд: правило узелка, предупреждение и совет на будущее.
 * Подряд они читаются как одна длинная.
 *
 * Режем по точке, но только снаружи разметки: в заметках есть <b>, и
 * точка внутри тега разорвала бы его.
 */
function noteHTML(note?: string): string {
  if (!note) return '';
  const parts = note.split(/(?<=\.)\s+(?=[А-ЯA-Z«])/).filter((s) => s.trim());
  if (parts.length < 2) return '<p class="note">' + note + '</p>';
  return '<ul class="note notelist">'
    + parts.map((s) => '<li>' + s.trim().replace(/\.$/, '') + '</li>').join('')
    + '</ul>';
}

export function bundleHTML(b: Bundle): string {
  const p = bprog(b), vis = (b.items || []).filter(visible);

  // Закрытый узелок по умолчанию свёрнут: смотреть на список того,
  // что уже сдано, незачем. Разворачивается кликом по заголовку.
  if (p.ok && S.openBundles.indexOf(b.id) < 0) {
    // Подписи «развернуть» нет: карточка кликабельна целиком, и так видно.
    // Разметка остаётся кнопкой с aria-expanded — скринридер скажет и без
    // текста, а с клавиатуры по ним ходят.
    return '<div class="bundle done folded">'
      + '<button class="bfold" data-fold="' + b.id + '"'
      + ' aria-expanded="false" aria-label="Развернуть: ' + esc(b.name) + '">'
      + '<span class="bf-ok">✓</span>'
      + '<span class="bf-name">' + esc(b.name) + '</span>'
      + '<span class="b g">' + p.n + '/' + p.n + '</span>'
      + '</button></div>';
  }

  // Заголовок закрытого узелка — кнопка на всю ширину, как у комнаты.
  const head = (p.ok ? '✓ ' : '') + esc(b.name)
    + '<span class="b g">' + p.c + '/' + p.n
    + (b.items && b.items.length > b.slots ? ' (из ' + b.items.length + ')' : '') + '</span>';

  let h = '<div class="bundle' + (p.ok ? ' done' : '') + '">'
    + '<h3>'
    + (p.ok
        ? '<button class="bhead" data-fold="' + b.id + '" aria-expanded="true"'
          + ' aria-label="Свернуть: ' + esc(b.name) + '">' + head
          + '<span class="chev" aria-hidden="true">▲</span></button>'
        : head)
    + '</h3>'
    + '<div class="meta">Награда: ' + esc(b.reward) + ' · реально закрыть: '
    + SEASON_RU[b.earliest].toLowerCase() + ', 1-й год</div>'
    + '<div class="bar" style="margin-bottom:6px"><i style="width:' + (p.c / p.n * 100) + '%"></i></div>';
  h += noteHTML(b.note);
  h += slotsHTML(b, vis)
    + '<ul class="items">' + vis.filter(isOpen).map((i) => '<li>' + itemHTML(i) + '</li>').join('') + '</ul>'
    + (vis.length < (b.items || []).length ? '<p class="note" style="margin:6px 0 0">скрыто фильтром: ' + ((b.items || []).length - vis.length) + '</p>' : '')
    + '</div>';
  return h;
}

const isOpen = (it: Item): boolean => S.openSrc.indexOf(it.id) >= 0;

/**
 * Узелок как в игре: сетка слотов вместо длинного столбца строк.
 *
 * Зачем: карточка с двенадцатью предметами растягивала ряд, соседние
 * оставались низкими, и в сетке зияли дыры. Плитки одинаковой высоты
 * этого не делают, а узелок к тому же так и выглядит в самой игре.
 *
 * Подробности не теряются: клик по плитке раскрывает ту же строку, что
 * была раньше, со всеми бейджами, подсказками и ссылкой на вики.
 * Галочка живёт в раскрытой строке — чтобы случайный клик по плитке
 * не отмечал предмет сданным.
 */
function slotsHTML(b: Bundle, vis: Item[]): string {
  if (!vis.length) return '';
  return '<div class="slots" role="list">'
    + vis.map((it) => {
      const d = done(it), s = st(it), open = isOpen(it);
      const ic = iconFor(it);
      // «Уже есть» и «растёт» — разные состояния, и красить их одинаково
      // нельзя: растущую тыкву это делало серой, и зелёная подсветка
      // «можно взять сейчас» до неё не доходила.
      const hv = d ? null : have(it);
      const hint = d ? ''
        : hv && enough(it, hv) ? ' slot-got'
        : hv && hv.growing !== undefined ? ' slot-grow'
        : ' ' + pickHint(s).replace(/hint-/g, 'slot-');
      return '<button type="button" role="listitem" class="slot'
        + (d ? ' done' : '') + (open ? ' open' : '') + hint + '"'
        + ' data-src="' + it.id + '" aria-expanded="' + open + '"'
        + ' aria-label="' + esc(it.n) + (it.q ? ', ' + it.q + ' шт.' : '')
        + (d ? ', сдано' : '') + '">'
        // Без иконки показывали две первые буквы — «ПА», «ДЫ» не
        // опознаются вообще. Пустая рамка честнее: она не притворяется
        // значком, а название под ней и так есть.
        + (ic
            ? '<img class="slot-img" src="' + ic + '" alt="" width="32" height="32">'
            : '<span class="slot-noimg" aria-hidden="true"></span>')
        + '<span class="slot-n">' + esc(it.n) + '</span>'
        + (it.q ? '<span class="slot-q">×' + it.q + '</span>' : '')
        + (it.gold ? '<span class="slot-g" title="золотое качество">★</span>' : '')
        + (d ? '<span class="slot-ok">✓</span>' : '')
        + '</button>';
    }).join('')
    + '</div>';
}

export function vaultHTML(r: Room): string {
  const ch = progress().checked;
  const paid = r.bundles.filter((b) => ch[b.id]).reduce((a, b) => a + (b.gold || 0), 0);
  return '<div class="panel"><h2>Сейф <em>— ' + paid.toLocaleString('ru') + ' / 42 500 з.</em></h2>'
    + '<p class="note">' + r.caution + '</p><div class="vault">'
    + r.bundles.map((b) => '<label><input type="checkbox" data-chk="' + b.id + '" ' + (ch[b.id] ? 'checked' : '') + '>'
      + '<span>' + esc(b.name) + '</span><span class="rw">' + esc(b.reward) + '</span></label>').join('')
    + '</div></div>';
}

export const flat = (arr: Item[], opts: ItemOpts = {}): string =>
  '<ul class="flat">' + arr.map((i) => '<li>' + itemHTML(i, { showBundle: true, ...opts }) + '</li>').join('') + '</ul>';

export const suggHTML = (list: string[]): string =>
  !list.length ? '' : '<div class="sugg">' + list.map((n) => '<button data-sugg="' + esc(n) + '">' + esc(n) + '</button>').join('') + '</div>';

/* ---- панель фильтров ---- */
/**
 * Ряда чипов со статусами здесь больше нет. Он дублировал блок «Сегодня»
 * и подсветку строк, два чипа из шести всегда показывали ноль, а по нажатию
 * он не показывал, а скрывал — вплоть до пропажи целых комнат. Дважды это
 * выглядело как поломка.
 *
 * Осталось то, что включаешь осознанно и видишь, что включил:
 * фильтр по локации и «скрыть собранное».
 */
export function filterBarHTML(): string {
  if (S.tab === 'plan') return '';
  if (S.q) {
    // без крестика: он тут был третьим способом очистить поиск, а сама
    // плашка стоит прямо под полем, где запрос и так виден
    return '<div class="fbar searching"><span class="pill">Поиск: ' + esc(S.q) + '</span>'
      + '<span class="sb-meta">фильтры отключены, пока идёт поиск</span></div>';
  }
  if (!S.locFilter || !LOC[S.locFilter]) return '';

  const tot = ALL.filter((i) => !i.bundle.room.extra).length;
  const vis = ALL.filter((i) => !i.bundle.room.extra && visible(i)).length;
  return '<div class="fbar">'
    + '<span class="pill on">📍 только: ' + esc(LOC[S.locFilter].n)
    + ' · показано ' + vis + ' из ' + tot + '</span>'
    + '<button id="fclear" class="fclear">× показать всё</button></div>';
}

/* ---- модалка локации ---- */
export function openLoc(key: string): void {
  const L = LOC[key];
  if (!L) return;
  const d = document.createElement('div');
  d.className = 'mask';
  d.id = 'mask';
  d.setAttribute('role', 'dialog');
  d.setAttribute('aria-modal', 'true');
  d.setAttribute('aria-label', L.n);
  d.innerHTML = '<div class="modal">'
    // крестик прилипает к верху: контент модалки длиннее окна,
    // и кнопка «Закрыть» внизу оказывалась за обрезом
    + '<button type="button" class="mclose" id="closemask" aria-label="Закрыть">✕</button>'
    + '<h3>' + esc(L.n) + '</h3>'
    + '<div class="mapbox"><img src="img/valley-map.png" alt="Карта долины">'
    + '<div class="pin" style="left:' + (L.pin[0] + 10) + 'px;top:' + (L.pin[1] + 10) + 'px"></div></div>'
    + (L.offmap ? '<p class="note">Маркер показывает, откуда попадать: ' + esc(L.offmap) + '. Сама локация за пределами карты долины.</p>' : '')
    + (L.gate ? '<div class="gatebox">🔒 Доступ: ' + esc(L.gate) + '</div>' : '')
    + '<p style="font-size:13.5px">' + esc(L.how) + '</p>'
    + (L.img ? '<img class="shot" src="' + L.img + '" alt="' + esc(L.n) + '">' : '')
    + '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">'
    + (ALL.some((i) => hasLoc(i, key)) ? '<button data-locfilter="' + key + '">Показать все предметы отсюда</button>' : '')
    + '<button data-ext="' + esc(wikiUrl(L.wiki)) + '">Статья на вики ↗</button>'
    + '<button data-close="1">Закрыть</button></div></div>';
  document.body.appendChild(d);

  const prev = document.activeElement as HTMLElement | null;
  d.querySelector<HTMLElement>('#closemask')?.focus();

  const close = (): void => {
    d.remove();
    document.removeEventListener('keydown', onKey);
    prev?.focus();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);

  d.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === d || t.id === 'closemask' || t.dataset.close) close();
  });
}

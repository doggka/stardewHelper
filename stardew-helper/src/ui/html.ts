import type { Bundle, Item, Room } from '../types';
import { LVL, LVL_NAME, LVL_ORDER, SEASON_RU, WIKI } from '../data/constants';
import { LOC } from '../data/locations';
import { ALL, S, progress } from '../state';
import { bprog, cartInfo, done, effLoc, hasLoc, st } from '../logic/status';
import { countsByLvl, filterActive, visible } from '../logic/filters';

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

export function itemHTML(it: Item, opts: ItemOpts = {}): string {
  const s = st(it), d = done(it), ci = cartInfo(it);
  const q = it.q ? ' <span class="qty">×' + it.q + '</span>' : '';
  const g = it.gold ? ' <span class="b g">золотое</span>' : '';
  const open = S.openSrc.indexOf(it.id) >= 0;

  let bd = '<span class="b ' + s.lvl + '">' + LVL[s.lvl] + '</span>';
  if (s.last && !d && !opts.lastIsImplied) {
    bd += '<span class="b last">⏳ последний сезон' + (ci.price ? ' · дальше торговка' : '') + '</span>';
  }
  bd += locChips(it);
  s.cond.forEach((c) => (bd += '<span class="b g">' + esc(c) + '</span>'));
  if (it.tree && !d) bd += '<span class="b g">дерево растёт 28 дней</span>';

  return '<div class="item' + (d ? ' ok' : '') + (open ? ' open' : '') + '" data-id="' + it.id + '">'
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
    + (it.warn && !d ? '<div class="warn">⚠ ' + it.warn + '</div>' : '')
    + '</div></div>';
}

export function bundleHTML(b: Bundle): string {
  const p = bprog(b), vis = (b.items || []).filter(visible);

  // Закрытый узелок по умолчанию свёрнут: смотреть на список того,
  // что уже сдано, незачем. Разворачивается кликом по заголовку.
  if (p.ok && S.openBundles.indexOf(b.id) < 0) {
    return '<div class="bundle done folded">'
      + '<button class="bfold" data-fold="' + b.id + '" aria-expanded="false">'
      + '<span class="bf-ok">✓</span>'
      + '<span class="bf-name">' + esc(b.name) + '</span>'
      + '<span class="b g">' + p.n + '/' + p.n + '</span>'
      + '<span class="bf-more">развернуть</span></button></div>';
  }

  let h = '<div class="bundle' + (p.ok ? ' done' : '') + '">'
    + (p.ok ? '<button class="bfold open" data-fold="' + b.id + '" aria-expanded="true">свернуть</button>' : '')
    + '<h3>' + (p.ok ? '✓ ' : '') + esc(b.name)

    + '<span class="b g">' + p.c + '/' + p.n + (b.items && b.items.length > b.slots ? ' (из ' + b.items.length + ')' : '') + '</span></h3>'
    + '<div class="meta">Награда: ' + esc(b.reward) + ' · реально закрыть: '
    + SEASON_RU[b.earliest].toLowerCase() + ', 1-й год</div>'
    + '<div class="bar" style="margin-bottom:6px"><i style="width:' + (p.c / p.n * 100) + '%"></i></div>';
  if (b.note) h += '<p class="note">' + b.note + '</p>';
  h += '<ul class="items">' + vis.map((i) => '<li>' + itemHTML(i) + '</li>').join('') + '</ul>'
    + (vis.length < (b.items || []).length ? '<p class="note" style="margin:6px 0 0">скрыто фильтром: ' + ((b.items || []).length - vis.length) + '</p>' : '')
    + '</div>';
  return h;
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
export function filterBarHTML(): string {
  if (S.tab === 'plan') return '';
  // во время поиска счётчики считают весь набор, а не результаты — они бы врали;
  // и вкладка больше не описывает то, что на экране
  if (S.q) {
    return '<div class="fbar searching"><span class="pill">Поиск: ' + esc(S.q)
      + ' <button type="button" data-act="clearSearch" aria-label="Сбросить поиск">✕</button></span>'
      + '<span class="sb-meta">вкладки и фильтры отключены, пока идёт поиск</span></div>';
  }
  const c = countsByLvl();
  let h = '<div class="legend" role="group" aria-label="Фильтр по статусу">';
  LVL_ORDER.forEach((k) => {
    const sel = S.filters.indexOf(k) >= 0, z = c[k] === 0 && !sel;
    h += '<button type="button" class="b ' + k + (sel ? ' sel' : '') + (z ? ' zero' : '') + '"'
      + ' data-f="' + k + '" aria-pressed="' + sel + '"' + (z ? ' disabled' : '') + '>'
      + (sel ? '✓ ' : '') + LVL_NAME[k] + '<span class="cnt">' + c[k] + '</span></button>';
  });
  // «скрыть собранное» и сброс живут в той же строке, что и чипы:
  // отдельная полоса под ними съедала высоту ради одного флажка
  h += '<label class="hd"><input type="checkbox" id="hd" ' + (S.hideDone ? 'checked' : '') + '>скрыть собранное</label>';
  if (S.locFilter && LOC[S.locFilter]) h += '<span class="pill">📍 только: ' + esc(LOC[S.locFilter].n) + '</span>';
  if (filterActive()) {
    const tot = ALL.filter((i) => !i.bundle.room.extra).length;
    const vis = ALL.filter((i) => !i.bundle.room.extra && visible(i)).length;
    h += '<span class="pill">показано ' + vis + ' из ' + tot + '</span>'
      + '<button id="fclear">× сбросить фильтр</button>';
  }
  h += '</div>';
  return h;
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

import type { Bundle, Item } from '../types';
import { DOW, LVL, SEASON_RU } from '../data/constants';
import { GATES, PLAN } from '../data/plan';
import { ALL, ROOMS, S } from '../state';
import { bprog, cartInfo, cartToday, dow, done, nextCart, st, totals } from '../logic/status';
import { filterActive, visible } from '../logic/filters';
import { norm } from '../logic/search';
import { bundleHTML, esc, flat, vaultHTML } from '../ui/html';
import { searchVerdict } from '../ui/searchVerdict';

function matchBundle(b: Bundle): boolean {
  if (!b.items) return false;
  if (!b.items.some(visible)) return false;
  if (S.q) {
    const q = norm(S.q);
    if (norm(b.name).indexOf(q) < 0 && !b.items.some((i) => norm(i.n).indexOf(q) >= 0)) return false;
  }
  return true;
}

export function renderRooms(): string {
  let h = searchVerdict();
  ROOMS.forEach((r) => {
    if (r.vault) {
      if (!S.q && !filterActive()) h += vaultHTML(r);
      return;
    }
    const bs = r.bundles.filter(matchBundle);
    if (!bs.length) return;
    const ok = r.bundles.filter((b) => bprog(b).ok).length;
    h += '<div class="panel"><h2 class="room">' + esc(r.name)
      + ' <span>' + ok + '/' + r.bundles.length + ' · ' + esc(r.open) + ' · награда: ' + esc(r.reward) + '</span></h2>'
      + (r.caution ? '<p class="note">⚠ ' + r.caution + '</p>' : '')
      + '<div class="grid">' + bs.map(bundleHTML).join('') + '</div></div>';
  });
  if (h) return h;
  return '<p class="empty">' + (filterActive()
    ? 'Под фильтр не попал ни один узелок. <button id="fclear">Сбросить фильтр</button>'
    : 'Ничего не найдено — попробуй другое название.') + '</p>';
}

export function renderTodo(): string {
  const open = ALL.filter((i) => !done(i) && !i.bundle.room.extra && !bprog(i.bundle).ok && visible(i));
  const urgent: Item[] = [], lost: Item[] = [], cart: Item[] = [], chain: Item[] = [];
  open.forEach((i) => {
    const s = st(i);
    if (s.lvl === 'past') lost.push(i);
    else if (s.last) urgent.push(i);
    else if (s.lvl === 'cart') cart.push(i);
    else if (i.c && i.earliest <= +S.season) chain.push(i);
  });
  let h = searchVerdict();
  // в панели про «последний сезон» бейдж с тем же текстом на каждой строке —
  // тавтология, которая вдобавок разгоняет строку с 48 до 74 пикселей
  h += '<div class="panel"><h2>⏳ Последний сезон сбора <em>— ' + SEASON_RU[S.season].toLowerCase()
    + '; дальше только торговка или 2-й год</em></h2>'
    + (urgent.length ? flat(urgent, { lastIsImplied: true })
      : '<p class="empty">Чисто — в этом сезоне ничего не закрывается.</p>') + '</div>';
  if (lost.length) h += '<div class="panel"><h2 style="color:#ff9b9b">🔴 В 1-м году уже никак</h2>'
    + '<p class="note">Сезон прошёл, и торговка эти предметы не продаёт. Остаётся 2-й год.</p>' + flat(lost) + '</div>';
  if (cart.length) h += '<div class="panel"><h2>🛒 Вне сезона — добирается у торговки</h2>'
    + '<p class="note">Сезон сбора прошёл, но эти предметы встречаются в повозке. Проверяй каждую пятницу и воскресенье.</p>' + flat(cart) + '</div>';
  if (chain.length) h += '<div class="panel"><h2>🔧 Требуют подготовки <em>— начинай заранее</em></h2>' + flat(chain) + '</div>';
  return h;
}

/** Момент, ради которого всё затевалось, не должен выглядеть как ещё одна панель. */
export function renderDone(): string {
  const t = totals();
  return '<div class="finale">'
    + '<div class="finale-mark">🎉</div>'
    + '<h2>Все ' + t.n + ' узелков закрыты</h2>'
    + '<p>Общественный центр восстановлен. Джунимо довольны, Джоджа посрамлена.</p>'
    + '<p class="note" style="font-style:normal">Осталось необязательное: Пропавший узелок '
    + 'в заброшенном ДжоджаМарте — он появляется в ночь перед дождём и открывает кинотеатр.</p>'
    + '<div class="actions"><button data-t="rooms">Посмотреть комнаты</button>'
    + '<button data-t="cart">🛒 Торговка</button></div></div>';
}

export function renderAvail(): string {
  const arr = ALL.filter((i) => !done(i) && !i.bundle.room.extra && !bprog(i.bundle).ok && visible(i))
    .filter((i) => {
      const l = st(i).lvl;
      return l === 'now' || l === 'cond';
    })
    .sort((a, b) => (st(a).lvl === 'now' ? 0 : 1) - (st(b).lvl === 'now' ? 0 : 1));
  // «Пусто.» не говорит ни почему, ни что делать — а причин минимум три
  const empty = filterActive()
    ? 'Под фильтр ничего не попало. <button id="fclear">Сбросить фильтр</button>'
    : 'В ' + SEASON_RU[S.season].toLowerCase() + ' при такой погоде собирать нечего — '
      + 'загляни во вкладку «План по сезонам».';
  return searchVerdict() + '<div class="panel"><h2>Доступно сейчас <em>— ' + SEASON_RU[S.season].toLowerCase() + ', '
    + (S.weather === 'rain' ? 'дождь' : 'ясно') + ' · ' + arr.length + ' предметов</em></h2>'
    + (arr.length ? flat(arr) : '<p class="empty">' + empty + '</p>') + '</div>';
}

export function renderCart(): string {
  const today = cartToday(), nx = nextCart();
  const open = ALL.filter((i) => !done(i) && !i.bundle.room.extra && !bprog(i.bundle).ok && visible(i));
  const buy: [Item, string][] = [], cant: [Item, string][] = [];
  open.forEach((i) => {
    const ci = cartInfo(i);
    if (ci.price) buy.push([i, ci.price]);
    else cant.push([i, ci.no as string]);
  });
  const prio = (i: Item) => {
    const l = st(i).lvl;
    return l === 'cart' ? 0 : i.warn ? 1 : l === 'past' ? 0 : l === 'later' ? 2 : 3;
  };
  buy.sort((a, b) => prio(a[0]) - prio(b[0]));
  const top = buy.filter((x) => prio(x[0]) <= 1);
  const sum = top.reduce((a, x) => a + parseInt(String(x[1]).split('–')[1], 10), 0);

  let h = searchVerdict();
  h += '<div class="panel"><h2>🛒 Странствующая торговка</h2>'
    + '<p style="font-size:13px;margin:0 0 8px">'
    + '<b>Пятница и воскресенье, 06:00–20:00</b> — '
    + '<button type="button" class="b loc" data-loc="cart">📍 Повозка торговки</button> в Пепельносмольном лесу, к югу от фермы.<br>'
    + 'Плюс <b>каждый день</b>: Ночной рынок 15–17 зимы (17:00–02:00) и Пустынный фестиваль 15–17 весны (12:00–02:00).</p>'
    + '<p style="font-size:13px;margin:0 0 8px">Ассортимент — 10 случайных предметов по 1–5 шт, цены каждый раз разные. '
    + 'Товары всегда <b>обычного качества</b>.</p>'
    + '<div class="gatebox">' + (today
      ? '✓ Сегодня (' + DOW[dow(S.day)] + ', ' + S.day + ' ' + SEASON_RU[S.season].toLowerCase() + '): ' + today
      : 'Сегодня ' + DOW[dow(S.day)].toLowerCase() + ' — торговки нет. ' + (nx !== null ? 'Ближайший визит через ' + nx + ' дн.' : 'В этом сезоне больше визитов нет.')) + '</div>'
    + '<label style="display:flex;gap:8px;align-items:center;font-size:13px;margin-top:8px">'
    + '<input type="checkbox" id="y1g" ' + (S.y1guarantee ? 'checked' : '') + ' style="accent-color:var(--gold);width:16px;height:16px">'
    + '<span>При создании фермы была включена «Гарантия завершения первого года»</span></label>'
    + (S.y1guarantee ? '<div class="gatebox" style="margin-top:8px">Семена красной капусты гарантированно появятся <b>один раз</b> между 7 весны и 16 зимы (Ночной рынок), в случайный день. Гарантия действует только в этот день — проверяй ассортимент <b>каждый</b> визит.</div>' : '')
    + '</div>';

  h += '<div class="panel"><h2>Список покупок <em>— ' + buy.length + ' позиций из узелков, которые она может привезти</em></h2>'
    + (top.length ? '<p class="note">Сверху — то, что иначе в этом году уже не добыть.</p>' : '')
    + '<table class="t"><tr><th>Предмет</th><th>Цена</th><th>Узелок</th><th>Статус</th></tr>'
    + buy.map((x) => {
      const i = x[0], s = st(i);
      return '<tr' + (prio(i) <= 1 ? ' style="background:#3a2e18"' : '') + '><td>' + esc(i.n) + (i.q ? ' ×' + i.q : '') + '</td><td>' + x[1] + ' з.</td>'
        + '<td>' + esc(i.bundle.name) + '</td><td><span class="b ' + s.lvl + '">' + LVL[s.lvl] + '</span></td></tr>';
    }).join('')
    + '</table>'
    + (top.length ? '<p style="font-size:13px;margin-top:9px">Держать в кармане на критичные позиции: <b>до ' + sum.toLocaleString('ru') + ' з.</b></p>' : '')
    + '</div>';

  h += '<div class="panel"><h2>❌ Торговка это не продаёт <em>— только добывать самому</em></h2>'
    + '<table class="t"><tr><th>Предмет</th><th>Узелок</th><th>Почему</th></tr>'
    + cant.map((x) => '<tr><td>' + esc(x[0].n) + '</td><td>' + esc(x[0].bundle.name) + '</td><td>' + esc(x[1]) + '</td></tr>').join('')
    + '</table></div>';
  return h;
}

export function renderPlan(): string {
  let h = searchVerdict() + '<div class="cols">';
  PLAN.forEach((p, idx) => {
    const closes: string[] = [];
    ROOMS.forEach((r) => {
      if (r.extra || r.vault) return;
      r.bundles.forEach((b) => {
        if (b.earliest === idx) closes.push(b.name);
      });
    });
    h += '<div class="season' + (idx === S.season ? ' cur' : '') + '"><h3>' + p.t + '</h3><ul>'
      + p.li.map((x) => '<li>' + x + '</li>').join('') + '</ul>'
      + (closes.length ? '<div class="closes">Реально закрыть к концу сезона:<br><b>' + closes.join('</b>, <b>') + '</b></div>'
        : '<div class="closes">Новых узелков не закрывается.</div>') + '</div>';
  });
  h += '</div>';
  h += '<div class="panel" style="margin-top:12px"><h2>🔒 Что открыть заранее</h2>'
    + '<table class="t"><tr><th>Открыть</th><th>Что разблокирует</th><th>Дедлайн</th></tr>'
    + GATES.map((g) => '<tr><td><b>' + g[0] + '</b></td><td>' + g[1] + '</td><td>' + g[2] + '</td></tr>').join('') + '</table></div>';
  h += '<div class="panel"><h2>Порядок, который не ломается</h2><ul style="margin:0;padding-left:18px;font-size:13px">'
    + '<li><b>Весна:</b> Комната искусств (кроме зимних дикоросов и экзотики), весенний урожай, речная рыба в дождь.</li>'
    + '<li><b>Лето:</b> Сейф (42 500 з.) → автобус → пустыня. Иглобрюх, папоротник и красная капуста — жёсткие окна.</li>'
    + '<li><b>Осень:</b> Кладовая целиком → теплица → сразу саженцы яблони и граната в теплицу.</li>'
    + '<li><b>Зима:</b> зимние дикоросы, наутилус, глубокая шахта, фрукты из теплицы → Кормовой и Волшебника.</li>'
    + '<li><b>Доску объявлений</b> добивай 1 весны 2-го года — ради дружбы с Кентом.</li></ul></div>';
  return h;
}

export function renderTrackerBody(): string {
  const t = totals();
  if (t.ok === t.n && S.tab === 'todo' && !S.q) return renderDone();
  return S.tab === 'rooms' ? renderRooms()
    : S.tab === 'plan' ? renderPlan()
    : S.tab === 'cart' ? renderCart()
    : S.tab === 'avail' ? renderAvail()
    : renderTodo();
}

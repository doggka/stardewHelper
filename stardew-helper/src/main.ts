import './ui/theme.css';
import { DOW, SEASON_RU } from './data/constants';
import { S, load, progress, sanitize, save } from './state';
import { cartToday, dow, nextCart, setDone, totals } from './logic/status';
import { esc, filterBarHTML, openLoc } from './ui/html';
import { clearRecent, markRecent, renderTrackerBody } from './screens/tracker';
import { setBridgeState } from './screens/today';
import { setBelongings } from './logic/have';
import { bridge, isDesktop, openExternal } from './bridge';

const shell = document.getElementById('shell') as HTMLElement;

/** Меню «⋯» и выбор способа запуска. Не в состоянии: открытость
 *  не должна переживать перезапуск. */
let menuOpen = false;
let playOpen = false;

/** Что нашлось в системе. Спрашиваем один раз при старте, не на каждый рендер. */
let gameFound = false;
let smapiOk = false;

/*
 * Ряда вкладок больше нет. «Не продолбать» и «Доступно сейчас» показывали
 * те же предметы, что и «Комнаты», только иначе отфильтрованные — теперь это
 * блок «Сегодня» наверху. План по сезонам и торговка — справочники,
 * они переехали в меню «⋯».
 */

/* ===================== ЭКРАН ТРЕКЕРА ===================== */

function trackerChrome(): string {
  const t = totals();
  const today = cartToday(), nx = nextCart();
  const cartLine = DOW[dow(S.day)]
    + (today ? ' · <b>🛒 торговка здесь</b>' : nx !== null ? ' · 🛒 через ' + nx + ' дн.' : ' · 🛒 в этом сезоне всё');

  const manualCount = Object.keys(progress().checked).length;
  const savedCount = S.save ? Object.values(S.save.progress).reduce((a, x) => a + x.length, 0) : 0;

  // Кто и где: ферма и игрок. Дата живёт рядом, в блоке «когда» — раньше она
  // была в двух местах сразу, в строке сейва и в селекторах под ней.
  const who = isDesktop
    ? (S.save
        ? '<span class="farm">🌱 ' + esc(S.save.farmName) + '</span>'
          + '<span class="who">' + esc(S.save.playerName) + '</span>'
        : '<span class="farm manual">Без сейва</span>'
          + '<span class="who">галочки вручную</span>')
    : '<span class="farm">🌱 Узелки Общественного центра</span>';

  // Если крутить сезон при загруженном сейве, это «заглянуть вперёд»,
  // а не «поменять дату». Говорим об этом только когда это действительно так.
  const peeking = S.save && (S.save.season !== S.season || S.save.day !== S.day);
  const peek = peeking
    ? '<span class="peek">смотришь другой сезон<button data-act="backToSave">вернуть ' + SEASON_RU[S.save!.season].toLowerCase()
      + ', день ' + S.save!.day + '</button></span>'
    : '';

  const when = '<div class="when">'
    + '<select id="season" aria-label="Сезон">'
    + [0, 1, 2, 3].map((i) => '<option value="' + i + '"' + (S.season === i ? ' selected' : '') + '>' + SEASON_RU[i] + '</option>').join('')
    + '</select>'
    + '<label for="day">день</label><input type="number" id="day" min="1" max="28" value="' + S.day + '">'
    + '<div class="seg" id="weather" role="group" aria-label="Погода">'
    + '<button data-w="sun"' + (S.weather === 'sun' ? ' class="on"' : '') + '>☀ Ясно</button>'
    + '<button data-w="rain"' + (S.weather === 'rain' ? ' class="on"' : '') + '>☔ Дождь</button>'
    + '</div>' + peek + '</div>';

  // Составная кнопка запуска: слева основное действие, справа выбор способа.
  // Прямой запуск exe идёт мимо Steam, поэтому «через Steam» — отдельный пункт,
  // а не выкинутый вариант.
  const LAUNCH: [string, string, string][] = [
    ['smapi', 'Через SMAPI', 'с модами'],
    ['direct', 'Напрямую', 'без модов'],
    ['steam', 'Через Steam', 'как обычно, со статистикой'],
  ];
  const curLaunch = LAUNCH.find((l) => l[0] === S.launchMode) ?? LAUNCH[0];
  const play = isDesktop && gameFound
    ? '<div class="menuwrap playwrap">'
      // способ видно на кнопке, а не в подсказке при наведении
      + '<button class="play" data-act="play">▶ Играть'
      + '<span class="pmode">' + esc(curLaunch[1].replace(/^Через /, '')) + '</span></button>'
      + '<button class="playmore" data-act="playMenu" aria-haspopup="true"'
      + ' aria-expanded="' + playOpen + '" aria-label="Чем запускать">▾</button>'
      + (playOpen
          ? '<div class="menu" role="menu">'
            + LAUNCH.map(([k, n, sub]) => {
              const off = k === 'smapi' && !smapiOk;
              return '<button role="menuitem" data-act="setLaunch" data-mode="' + k + '"'
                + (off ? ' disabled title="SMAPI не установлен"' : '')
                + (S.launchMode === k ? ' class="cur"' : '') + '>'
                + (S.launchMode === k ? '✓ ' : '') + n
                + '<small>' + (off ? 'SMAPI не установлен' : sub) + '</small></button>';
            }).join('')
            + '</div>'
          : '')
      + '</div>'
    : '';

  // Служебное — в меню: этим пользуются раз в месяц, а места в шапке
  // оно занимало наравне с тем, на что смотришь каждую минуту.
  const menu = '<div class="menuwrap">'
    + '<button class="menubtn" data-act="menu" aria-haspopup="true" aria-expanded="' + menuOpen + '"'
    + ' aria-label="Ещё">⋯</button>'
    + (menuOpen
        ? '<div class="menu" role="menu">'
          + (isDesktop && S.save ? '<button role="menuitem" data-act="resync">↻ Обновить из сейва</button>' : '')
          + (isDesktop ? '<button role="menuitem" data-act="chooseSave">'
              + (S.save ? 'Сменить сейв' : 'Выбрать сейв') + '</button>' : '')
          + '<div class="msep"></div>'
          // переехало из шапки вместе с чипами-фильтрами: меняет работу
          // со списком, но нажимается редко
          + '<button role="menuitem" data-act="hideDone">'
          + (S.hideDone ? '✓ ' : '') + 'Скрыть собранное</button>'
          + '<div class="msep"></div>'
          + '<button role="menuitem" data-t="plan">План по сезонам</button>'
          + '<button role="menuitem" data-t="cart">🛒 Торговка</button>'
          + (isDesktop ? '<button role="menuitem" data-act="mods">Моды</button>' : '')
          + '<div class="msep"></div>'
          + '<button role="menuitem" data-act="export">Экспорт прогресса</button>'
          + '<button role="menuitem" data-act="import">Импорт прогресса</button>'
          + '<div class="msep"></div>'
          + '<button role="menuitem" data-act="reset" class="danger">Снять галочки этой фермы</button>'
          + (Object.keys(S.bySave).length
              ? '<button role="menuitem" data-act="resetAll" class="danger">Стереть все данные</button>' : '')
          + '</div>'
        : '')
    + '</div>';

  /**
   * Две вкладки, и только две. Комнаты — состояние узелков, День — всё про
   * сегодня. План и Торговка остались справочниками в меню «⋯»: если вернуть
   * и их, мы опять придём к четырём вкладкам, от которых уходили.
   *
   * Во время поиска переключатель не показываем: поиск и так уводит
   * в комнаты и описывает то, что на экране.
   */
  const tabsHTML = (): string => {
    if (S.q) return '';
    const tab = (k: string, n: string): string =>
      '<button data-t="' + k + '"' + (S.tab === k ? ' class="on" aria-current="page"' : '') + '>'
      + n + '</button>';
    return '<div class="tabs" role="navigation" aria-label="Разделы">'
      + tab('rooms', 'Комнаты') + tab('day', 'День') + '</div>';
  };

  return '<a class="skip" href="#view">К списку</a><header>'
    // один ряд с переносом: на широком окне всё в строку, на узком само
    // раскладывается в два, без отдельной полупустой полосы
    + '<div class="ctxbar">' + who
    + '<span class="prog"><b>' + t.ok + ' из ' + t.n + '</b> узелков</span>'
    + '<div class="bar"><i style="width:' + (t.ok / t.n * 100) + '%"></i></div>'
    + '<span class="cartday">' + cartLine + '</span>'
    + (savedCount ? '<span class="dimnote">отмечено ' + manualCount + ', из сейва ' + savedCount + '</span>' : '')
    + '<span class="ctx-sp"></span>' + when + play + menu + '</div>'
    + '<div class="searchrow' + (S.q ? ' active' : '') + '">'
    + '<span class="sicon" aria-hidden="true">🔎</span>'
    + '<input type="search" id="q" aria-label="Поиск предмета"'
    + ' placeholder="Нужен ли предмет для узелков? Введи название…"'
    + ' value="' + (S.q || '').replace(/"/g, '&quot;') + '">'
    + (S.q ? '<button data-act="clearSearch" aria-label="Сбросить поиск">✕</button>' : '')
    + '</div>'
    + tabsHTML()
    + '</header>'
    + '<main>'
    // во время поиска полоса нужна на любой вкладке: поиск показывает
    // комнаты, и плашка «Поиск: …» объясняет, почему на экране именно они
    + (S.tab === 'rooms' || S.q
        ? '<div id="filters">' + filterBarHTML() + '</div>'
        : S.tab === 'day' ? ''
        : '<button class="backlink" data-t="rooms">← К комнатам</button>')
    + '<div id="view" tabindex="-1">' + renderTrackerBody() + '</div></main>'
    + '<div class="foot">Данные с ru.stardewvalleywiki.com · обычный набор узелков '
    + '(не «перемешанные узелки» из настроек фермы) · прогресс хранится локально</div>';
}

/* ===================== РОУТЕР ===================== */

/**
 * Запоминаем, на чём стоял фокус, чтобы вернуть его после перерисовки.
 * render() пересобирает DOM целиком — без этого после каждой галочки
 * фокус улетает на body, и клавиатурой список не пройти.
 */
function focusKey(): { key: string | null; caret: number | null } {
  const a = document.activeElement as HTMLElement | null;
  if (!a) return { key: null, caret: null };
  const key = a.dataset?.chk ? 'chk:' + a.dataset.chk
    : a.dataset?.src ? 'src:' + a.dataset.src
    : a.dataset?.t ? 'tab:' + a.dataset.t
    : a.dataset?.f ? 'flt:' + a.dataset.f
    : a.id ? 'id:' + a.id
    : null;
  const caret = a instanceof HTMLInputElement && a.type === 'search' ? a.selectionStart : null;
  return { key, caret };
}

function restoreFocus(key: string | null, caret: number | null): void {
  if (!key) return;
  const sep = key.indexOf(':');
  const kind = key.slice(0, sep), val = key.slice(sep + 1);
  const attr: Record<string, string> = { chk: 'data-chk', src: 'data-src', tab: 'data-t', flt: 'data-f' };
  const el = kind === 'id'
    ? document.getElementById(val)
    : shell.querySelector<HTMLElement>('[' + attr[kind] + '="' + CSS.escape(val) + '"]');
  if (!el) return;
  el.focus();
  // каретка в поиске: без этого следующий символ уезжает в начало строки
  if (caret !== null && el instanceof HTMLInputElement) el.setSelectionRange(caret, caret);
}

/**
 * Анимация появления нужна при переходе между экранами, а не при каждой
 * перерисовке. Раньше класс .screen вешался всегда, элемент создавался
 * заново — и браузер играл fade с нуля на каждую галочку. Это и было моргание.
 */
let lastScreen: string | null = null;
function screenClass(): string {
  const changed = lastScreen !== S.screen;
  lastScreen = S.screen;
  return changed ? ' class="screen"' : '';
}

export function render(): void {
  const sy = shell.scrollTop;
  const { key, caret } = focusKey();
  if (S.screen === 'tracker') {
    shell.innerHTML = '<div' + screenClass() + '>' + trackerChrome() + '</div>';
    shell.scrollTop = sy;
    restoreFocus(key, caret);
  } else {
    // экраны онбординга подключаются динамически, чтобы не тянуть их в трекер
    void renderOnboarding();
  }
}

let onboarding: typeof import('./screens/onboarding') | null = null;
async function renderOnboarding(): Promise<void> {
  if (!onboarding) onboarding = await import('./screens/onboarding');
  shell.innerHTML = '<div' + screenClass() + '>' + (await onboarding.screenHTML()) + '</div>';
}

/* ===================== СОБЫТИЯ ===================== */

document.addEventListener('change', (e) => {
  const el = e.target as HTMLInputElement;
  if (el.id === 'y1g') { S.y1guarantee = el.checked; save(); render(); return; }
  if (el.id === 'hd') { S.hideDone = el.checked; save(); render(); return; }
  if (el.id === 'season') { S.season = +el.value as 0 | 1 | 2 | 3; save(); render(); return; }
  if (el.id === 'day') {
    let v = parseInt(el.value, 10);
    if (isNaN(v) || v < 1) v = 1;
    if (v > 28) v = 28;
    S.day = v; save(); render(); return;
  }
  const id = el.dataset.chk;
  if (!id) return;
  setDone(id, el.checked);
  // отмеченное остаётся на месте зачёркнутым до смены вкладки
  if (el.checked) markRecent(id);
  save(); render();
});

/**
 * Все атрибуты, которые что-то значат при клике. Ищем ближайший элемент
 * с любым из них, а не смотрим только на цель клика: у кнопок внутри есть
 * `<span>`-ы, и попадание по тексту проваливалось мимо обработчика —
 * свёрнутый узелок разворачивался только при клике в зазор между словами.
 */
const CLICKABLE = ['win', 'ext', 'f', 'locfilter', 'sugg', 'loc', 'src', 'w',
  'fold', 'today', 't', 'act'].map((a) => '[data-' + a + ']').join(',');

document.addEventListener('click', (e) => {
  const el = e.target as HTMLElement;
  const hit = el.closest<HTMLElement>(CLICKABLE) ?? el;
  const d = hit.dataset;

  // клик мимо открытого меню — закрыть и ничего больше не делать
  if ((menuOpen || playOpen) && !el.closest('.menuwrap')) {
    menuOpen = false;
    playOpen = false;
    render();
    return;
  }

  if (d.win) {
    if (!bridge) return;
    if (d.win === 'min') void bridge.window.minimize();
    else if (d.win === 'max') void bridge.window.toggleMaximize();
    else void bridge.window.close();
    return;
  }
  if (d.ext) { openExternal(d.ext); return; }
  if (el.id === 'fclear') { S.locFilter = null; save(); render(); return; }
  if (d.locfilter) {
    S.locFilter = d.locfilter; S.tab = 'rooms';
    document.getElementById('mask')?.remove();
    save(); render(); shell.scrollTop = 0; return;
  }
  if (d.sugg) { S.q = d.sugg; save(); render(); return; }
  if (d.loc) { openLoc(d.loc); return; }
  if (d.src !== undefined) {
    const i = S.openSrc.indexOf(d.src);
    if (i >= 0) S.openSrc.splice(i, 1);
    else S.openSrc.push(d.src);
    save(); render(); return;
  }
  if (d.w) { S.weather = d.w as 'sun' | 'rain'; save(); render(); return; }
  if (d.fold) {
    const i = S.openBundles.indexOf(d.fold);
    if (i >= 0) S.openBundles.splice(i, 1);
    else S.openBundles.push(d.fold);
    save(); render(); return;
  }
  // строка блока «Сегодня» раскрывается на месте: ни фильтров, ни перехода
  if (d.today) {
    const i = S.todayOpen.indexOf(d.today);
    if (i >= 0) S.todayOpen.splice(i, 1);
    else S.todayOpen.push(d.today);
    save(); render(); return;
  }
  if (d.t) {
    S.tab = d.t; menuOpen = false; clearRecent();
    save(); render(); shell.scrollTop = 0; return;
  }
  if (d.act) { void action(d.act, hit); return; }
});

/*
 * Сворачивания шапки при прокрутке здесь больше нет. Оно давало петлю:
 * схлопывание меняло высоту → содержимое подпрыгивало → браузер правил
 * позицию прокрутки → обработчик видел «скроллят вверх» → шапка
 * разворачивалась обратно. На медленной прокрутке это было видно как дёрганье.
 * Плюс оно прятало ровно то, что нужно всегда: поиск и дату.
 */

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menuOpen) {
    menuOpen = false;
    render();
    document.querySelector<HTMLElement>('.menubtn')?.focus();
  }
});

let qt: number | undefined;
document.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  if (el.id !== 'q') return;
  clearTimeout(qt);
  qt = window.setTimeout(() => {
    S.q = el.value;
    save();
    render(); // фокус и каретку возвращает restoreFocus внутри render
  }, 220);
});

async function action(name: string, el: HTMLElement): Promise<void> {
  if (name === 'menu') { menuOpen = !menuOpen; playOpen = false; render(); return; }
  if (name === 'playMenu') { playOpen = !playOpen; menuOpen = false; render(); return; }
  // любое действие из меню его же и закрывает
  if (menuOpen) menuOpen = false;
  if (playOpen) playOpen = false;

  if (name === 'setLaunch') {
    // только запоминаем способ: запускает кнопка «Играть», а не выбор в меню
    const m = el.closest<HTMLElement>('[data-mode]')?.dataset.mode;
    if (m) S.launchMode = m;
    save();
    render();
    return;
  }
  if (name === 'play') { await launch(); return; }

  if (name === 'backToSave') {
    if (S.save) { S.season = S.save.season; S.day = S.save.day; }
    save(); render(); return;
  }
  if (name === 'export') {
    const b = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = 'stardew-helper.json';
    a.click();
    return;
  }
  if (name === 'import') {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = '.json';
    i.onchange = () => {
      const f = i.files?.[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const parsed = JSON.parse(String(r.result));
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('не объект');
          }
          Object.assign(S, parsed);
          // JSON.parse пропускает любой валидный мусор: без этого
          // {"bySave": null} снесло бы прогресс по всем фермам
          sanitize(S);
          save();
          render();
        } catch {
          alert('Не похоже на файл прогресса');
        }
      };
      r.readAsText(f);
    };
    i.click();
    return;
  }
  if (name === 'reset') {
    if (confirm('Снять все галочки у этого сейва? Сам сейв и выбор фермы останутся.')) {
      S.bySave[S.saveId] = { checked: {} };
      save();
      render();
    }
    return;
  }
  if (name === 'resetAll') {
    if (!confirm('Стереть вообще всё: выбранный сейв, галочки по всем фермам, фильтры?\n\nСохранения игры это не затронет — в них я не пишу.')) return;
    S.bySave = {};
    S.saveId = 'manual';
    S.save = null;
    S.hideDone = false;
    S.locFilter = null;
    S.q = '';
    S.tab = 'rooms';
    S.todayOpen = [];
    S.modsSeen = false;
    S.screen = 'welcome';
    save();
    render();
    return;
  }
  if (name === 'cartInfo') { S.tab = 'cart'; save(); render(); shell.scrollTop = 0; return; }
  if (name === 'hideDone') { S.hideDone = !S.hideDone; menuOpen = false; save(); render(); return; }

  if (name === 'clearSearch') {
    S.q = '';
    save(); render();
    (document.getElementById('q') as HTMLInputElement | null)?.focus();
    return;
  }
  if (name === 'chooseSave') { S.screen = 'welcome'; save(); render(); return; }
  if (name === 'mods') { S.screen = 'mods'; save(); render(); return; }

  // остальные действия живут в экранах онбординга
  if (!onboarding) onboarding = await import('./screens/onboarding');
  await onboarding.action(name, el);
}

async function launch(): Promise<void> {
  if (!bridge) return;
  const r = await bridge.game.launch(S.launchMode);
  if (!r.ok) alert('Не удалось запустить игру: ' + (r.error || 'неизвестная причина'));
}

/**
 * Что лежит в сундуках и растёт на грядках. Молча проглатываем ошибку:
 * без этих данных приложение работает как раньше, просто без подсказок
 * «у тебя это уже есть».
 */
async function refreshBelongings(id: string): Promise<void> {
  if (!bridge) return;
  try {
    setBelongings(await bridge.saves.belongings(id));
    render();
  } catch {
    setBelongings(null);
  }
}

/**
 * Вернулся из игры — перечитываем сейв. Иначе прогресс на экране старый,
 * и надо вспоминать про кнопку «Обновить из сейва».
 */
function watchFocus(): void {
  const b = bridge;
  if (!b) return;
  window.addEventListener('focus', () => {
    // ассортимент торговки мод переписывает каждый игровой день
    void b.game.bridge().then((st) => {
      setBridgeState(st);
      if (st) render();
    });
    // сундуки и грядки берутся из сейва, а он переписывается при каждом сне
    if (S.save) void refreshBelongings(S.save.id);
    // SMAPI могли поставить, пока приложение открыто — иначе пункт меню
    // так и останется серым до перезапуска
    void b.game.detect().then((g) => {
      if (g.smapiInstalled === smapiOk && !!g.path === gameFound) return;
      smapiOk = g.smapiInstalled;
      gameFound = !!g.path;
      render();
    });
    if (!S.save || S.screen !== 'tracker') return;
    void (async () => {
      const fresh = await b.saves.read(S.save!.id);
      if (!fresh || !fresh.bundlesSupported) return;
      const before = JSON.stringify(S.save!.progress) + S.save!.day + S.save!.season;
      const after = JSON.stringify(fresh.progress) + fresh.day + fresh.season;
      if (before === after) return;
      if (!onboarding) onboarding = await import('./screens/onboarding');
      onboarding.applySave(fresh);
      save();
      render();
    })();
  });
}

/* ===================== СТАРТ ===================== */

// Ручка для отладки: в сборке её нет, в дев-режиме через неё удобно
// прогонять состояния, не кликая по интерфейсу.
if (import.meta.env.DEV) {
  void (async () => {
    const [state, status, filters] = await Promise.all([
      import('./state'), import('./logic/status'), import('./logic/filters'),
    ]);
    (window as unknown as Record<string, unknown>).__dbg = {
      ...status, ...filters, S, ALL: state.ALL, ROOMS: state.ROOMS, render, save,
    };
  })();
}

load();
if (!isDesktop) S.screen = 'tracker'; // в браузере онбординг не нужен: сейвы недоступны
render();
watchFocus();

// путь к игре спрашиваем один раз: от него зависит, показывать ли «Играть»
if (bridge) {
  void bridge.game.detect().then((g) => {
    gameFound = !!g.path;
    smapiOk = g.smapiInstalled;
    if (gameFound) render();
  });
  void bridge.game.bridge().then((st) => {
    if (!st) return;
    setBridgeState(st);
    render();
  });
  if (S.save) void refreshBelongings(S.save.id);
}

import './ui/theme.css';
import { DOW, SEASON_RU } from './data/constants';
import { S, load, progress, sanitize, save } from './state';
import { cartToday, dow, nextCart, setDone, totals } from './logic/status';
import { esc, filterBarHTML, openLoc } from './ui/html';
import { renderTrackerBody } from './screens/tracker';
import { bridge, isDesktop, openExternal } from './bridge';

const shell = document.getElementById('shell') as HTMLElement;

/** Подпись у первой вкладки — она единственная не говорит, что внутри. */
const TABS: [string, string, string?][] = [
  ['todo', '⚠ Не продолбать', '— закрывается в этом сезоне'],
  ['rooms', 'Комнаты'],
  ['plan', 'План по сезонам'],
  ['cart', '🛒 Торговка'],
  ['avail', 'Доступно сейчас'],
];

/* ===================== ЭКРАН ТРЕКЕРА ===================== */

function trackerChrome(): string {
  const t = totals();
  const today = cartToday(), nx = nextCart();
  const cartLine = DOW[dow(S.day)]
    + (today ? ' · <b>🛒 торговка здесь</b>' : nx !== null ? ' · 🛒 через ' + nx + ' дн.' : ' · 🛒 в этом сезоне всё');

  // Отдельная строка: какой сейв открыт и что с ним можно сделать.
  // Раньше это были мелкие кнопки внутри плотного ряда контролов — их не замечали.
  const manualCount = Object.keys(progress().checked).length;
  const savedCount = S.save ? Object.values(S.save.progress).reduce((a, x) => a + x.length, 0) : 0;
  const marks = savedCount
    ? 'отмечено ' + manualCount + ', из сейва ' + savedCount
    : 'отмечено ' + manualCount;
  const saveBar = isDesktop
    ? '<div class="savebar' + (S.save ? '' : ' manual') + '">'
      + (S.save
          ? '<span class="sb-name">🌱 ' + esc(S.save.farmName) + '</span>'
            + '<span class="sb-meta">' + esc(S.save.playerName) + ' · ' + SEASON_RU[S.save.season].toLowerCase()
            + ', день ' + S.save.day + ', год ' + S.save.year + '</span>'
            + '<span class="sb-meta">' + marks + '</span>'
          : '<span class="sb-name">Режим без сейва</span>'
            + '<span class="sb-meta">галочки ставишь вручную, ' + marks + '</span>')
      + '<span class="sb-sp"></span>'
      + (S.save ? '<button data-act="resync">↻ Обновить из сейва</button>' : '')
      + '<button data-act="chooseSave">' + (S.save ? 'Сменить сейв' : 'Выбрать сейв') + '</button>'
      // прятать нечего, пока ничего не накоплено: на первом запуске
      // деструктивная кнопка только пугает
      + (Object.keys(S.bySave).length ? '<button data-act="resetAll" class="danger">Стереть все данные</button>' : '')
      + '</div>'
    : '';

  // название приложения уже есть в титулбаре — здесь говорим о цели
  return '<a class="skip" href="#view">К списку</a><header>'
    + '<h1>Закрыть за первый год <small>— 30 узелков Общественного центра</small></h1>'
    + saveBar
    + '<div class="row">'
    + '<div class="ctl"><label>Сезон</label>'
    + '<select id="season">'
    + [0, 1, 2, 3].map((i) => '<option value="' + i + '"' + (S.season === i ? ' selected' : '') + '>' + SEASON_RU[i] + '</option>').join('')
    + '</select>'
    + '<label>день</label><input type="number" id="day" min="1" max="28" style="width:52px" value="' + S.day + '"></div>'
    + '<div class="ctl"><label>Погода</label><div class="seg" id="weather">'
    + '<button data-w="sun"' + (S.weather === 'sun' ? ' class="on"' : '') + '>☀ Ясно</button>'
    + '<button data-w="rain"' + (S.weather === 'rain' ? ' class="on"' : '') + '>☔ Дождь</button>'
    + '</div></div>'
    + '<div class="cartday">' + cartLine + '</div>'
    + '<div class="ctl" style="flex:1;min-width:160px"><label>Узелки</label>'
    + '<span style="font-variant-numeric:tabular-nums">' + t.ok + '/' + t.n + '</span>'
    + '<div class="bar"><i style="width:' + (t.ok / t.n * 100) + '%"></i></div></div>'
    + '<div class="ctl"><input type="search" id="q" placeholder="название предмета"'
    + ' aria-label="Поиск предмета" style="width:180px" value="' + (S.q || '').replace(/"/g, '&quot;') + '"></div>'
    + '<div class="ctl"><button data-act="export">Экспорт</button><button data-act="import">Импорт</button>'
    + (isDesktop ? '<button data-act="mods">Моды</button>' : '')
    + '<button data-act="reset">Снять галочки этой фермы</button></div>'
    + '</div>'
    + '<p class="searchhint">Введи название — скажу, нужен ли он для узелков</p>'
    + '<div class="tabs' + (S.q ? ' dimmed' : '') + '" id="tabs" role="tablist" aria-label="Разделы">'
    + TABS.map(([k, n, sub]) => '<button role="tab" data-t="' + k + '"'
      + ' aria-selected="' + (S.tab === k) + '"' + (S.tab === k ? ' class="on"' : '') + '>'
      + n + (sub ? ' <small>' + sub + '</small>' : '') + '</button>').join('')
    + '</div></header>'
    + '<main><div id="filters">' + filterBarHTML() + '</div>'
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

export function render(): void {
  const sy = shell.scrollTop;
  const { key, caret } = focusKey();
  if (S.screen === 'tracker') {
    shell.innerHTML = '<div class="screen">' + trackerChrome() + '</div>';
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
  shell.innerHTML = '<div class="screen">' + (await onboarding.screenHTML()) + '</div>';
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
  save(); render();
});

document.addEventListener('click', (e) => {
  const el = e.target as HTMLElement;
  const d = el.dataset;

  if (d.win) {
    if (!bridge) return;
    if (d.win === 'min') void bridge.window.minimize();
    else if (d.win === 'max') void bridge.window.toggleMaximize();
    else void bridge.window.close();
    return;
  }
  if (d.ext) { openExternal(d.ext); return; }
  if (el.id === 'fclear') { S.filters = []; S.hideDone = false; S.locFilter = null; save(); render(); return; }
  if (d.f !== undefined) {
    if (el.classList.contains('zero')) return;
    const i = S.filters.indexOf(d.f);
    if (i >= 0) S.filters.splice(i, 1);
    else S.filters.push(d.f);
    save(); render(); return;
  }
  if (d.locfilter) {
    S.locFilter = d.locfilter; S.tab = 'rooms'; S.filters = [];
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
  if (d.t) { S.tab = d.t; save(); render(); shell.scrollTop = 0; return; }
  if (d.act) { void action(d.act, el); return; }
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
    S.filters = [];
    S.hideDone = false;
    S.locFilter = null;
    S.q = '';
    S.tab = 'todo';
    S.modsSeen = false;
    S.screen = 'welcome';
    save();
    render();
    return;
  }
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

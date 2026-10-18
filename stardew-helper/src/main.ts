import './ui/theme.css';
import { DOW, SEASON_RU } from './data/constants';
import { S, load, save } from './state';
import { cartToday, dow, nextCart, setDone, totals } from './logic/status';
import { filterBarHTML, openLoc } from './ui/html';
import { renderTrackerBody } from './screens/tracker';
import { bridge, isDesktop, openExternal } from './bridge';

const shell = document.getElementById('shell') as HTMLElement;

/* ===================== ЭКРАН ТРЕКЕРА ===================== */

function trackerChrome(): string {
  const t = totals();
  const today = cartToday(), nx = nextCart();
  const cartLine = DOW[dow(S.day)]
    + (today ? ' · <b>🛒 торговка здесь</b>' : nx !== null ? ' · 🛒 через ' + nx + ' дн.' : ' · 🛒 в этом сезоне всё');

  const saveChip = S.save
    ? '<div class="savechip">🌱 ' + S.save.farmName + ' · ' + SEASON_RU[S.save.season].toLowerCase() + ', день ' + S.save.day
      + '<button data-act="resync">Обновить</button><button data-act="chooseSave">Сменить</button></div>'
    : isDesktop
      ? '<div class="savechip" style="background:#2a241c;border-color:var(--line);color:var(--dim)">ручной режим'
        + '<button data-act="chooseSave">Выбрать сейв</button></div>'
      : '';

  return '<header>'
    + '<h1>Узелки Общественного центра <small>— закрыть за 1-й год</small></h1>'
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
    + saveChip
    + '<div class="ctl" style="flex:1;min-width:160px"><label>Узелки</label>'
    + '<span style="font-variant-numeric:tabular-nums">' + t.ok + '/' + t.n + '</span>'
    + '<div class="bar"><i style="width:' + (t.ok / t.n * 100) + '%"></i></div></div>'
    + '<div class="ctl"><input type="search" id="q" placeholder="предмет: нужен или нет?" style="width:180px" value="' + (S.q || '').replace(/"/g, '&quot;') + '"></div>'
    + '<div class="ctl"><button data-act="export">Экспорт</button><button data-act="import">Импорт</button>'
    + (isDesktop ? '<button data-act="mods">Моды</button>' : '') + '<button data-act="reset">Сброс</button></div>'
    + '</div>'
    + '<div class="tabs" id="tabs">'
    + [['todo', '⚠ Не продолбать'], ['rooms', 'Комнаты'], ['plan', 'План по сезонам'], ['cart', '🛒 Торговка'], ['avail', 'Доступно сейчас']]
      .map(([k, n]) => '<button data-t="' + k + '"' + (S.tab === k ? ' class="on"' : '') + '>' + n + '</button>').join('')
    + '</div></header>'
    + '<main><div id="filters">' + filterBarHTML() + '</div><div id="view">' + renderTrackerBody() + '</div></main>'
    + '<div class="foot">Данные с ru.stardewvalleywiki.com · стандартный (не смешанный) набор узелков · прогресс хранится локально</div>';
}

/* ===================== РОУТЕР ===================== */

export function render(): void {
  const sy = shell.scrollTop;
  if (S.screen === 'tracker') {
    shell.innerHTML = '<div class="screen">' + trackerChrome() + '</div>';
    shell.scrollTop = sy;
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
  if (d.src !== undefined) { el.closest('.item')?.classList.toggle('open'); return; }
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
    render();
    (document.getElementById('q') as HTMLInputElement | null)?.focus();
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
          Object.assign(S, JSON.parse(String(r.result)));
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
    if (confirm('Сбросить прогресс этого сейва?')) {
      S.bySave[S.saveId] = { checked: {} };
      save();
      render();
    }
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

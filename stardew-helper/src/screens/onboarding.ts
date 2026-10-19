import type { ModInfo, SaveSummary } from '../types';
import { SEASON_RU } from '../data/constants';
import { ROOMS, S, progress, save } from '../state';
import { bridge, openExternal } from '../bridge';
import { esc } from '../ui/html';

let saves: SaveSummary[] = [];
let mods: ModInfo[] = [];
let gamePath: string | null = null;
let dropPath = '';

/** Описания модов живут здесь, а не в процессе Electron: это текст для человека. */
const MOD_TEXT: Record<string, { what: string; why: string; url: string }> = {
  SMAPI: {
    what: 'загрузчик модов',
    why: 'без него не работает ничего из списка ниже',
    url: 'https://smapi.io/',
  },
  NPCMapLocations: {
    what: 'все жители и игроки на карте, плюс миникарта',
    why: 'не бегать по городу в поисках нужного NPC',
    url: 'https://www.nexusmods.com/stardewvalley/mods/239',
  },
  UIInfoSuite2: {
    what: 'подсказки прямо в интерфейсе игры',
    why: 'иконка торговки пульсирует, когда у неё есть предметы для узелков — прямо под красную капусту',
    url: 'https://www.nexusmods.com/stardewvalley/mods/43127',
  },
  LookupAnything: {
    what: 'F1 по любому объекту — подробности',
    why: '«когда созреет», «что этому нравится» без похода на вики',
    url: 'https://www.nexusmods.com/stardewvalley/mods/541',
  },
  DataLayers: {
    what: 'оверлей зон покрытия',
    why: 'спринклеры, пугала, ульи и скрытые проходы видно сразу',
    url: 'https://www.nexusmods.com/stardewvalley/mods/1691',
  },
};

export async function screenHTML(): Promise<string> {
  return S.screen === 'mods' ? await modsHTML() : await welcomeHTML();
}

/* ===================== ЭКРАН 1 — ПРИВЕТСТВИЕ ===================== */

async function welcomeHTML(): Promise<string> {
  saves = bridge ? await bridge.saves.list() : [];

  const bundleNames = new Map<string, string>();
  for (const r of ROOMS) for (const b of r.bundles) bundleNames.set(b.id, b.name);

  const cards = saves.map((s) => {
    const bad = !s.bundlesSupported;
    let note: string;
    if (bad) {
      note = ' · <span style="color:#ffc48c">' + esc(s.unsupportedReason || '') + '</span>';
    } else {
      note = ' · ' + s.completedBundles + ' из 30 узелков';
      if (s.skipped.length) {
        note += ' · <span style="color:#ffc48c">пропущу ' + s.skipped.map((i) => esc(bundleNames.get(i) || i)).join(', ')
          + ' — в этой версии игры состав был другим</span>';
      }
    }
    // кнопка, а не div: это основное действие экрана, оно должно
    // нажиматься с клавиатуры и объявляться скринридером
    return '<button type="button" class="savecard' + (bad ? ' bad' : '') + '"'
      + ' data-act="pickSave" data-id="' + esc(s.id) + '">'
      + '<span class="sc-main"><span class="nm">' + esc(s.farmName) + '</span>'
      + '<span class="who">' + esc(s.playerName) + note + '</span></span>'
      + '<span class="when"><b>' + SEASON_RU[s.season].toLowerCase() + ', день ' + s.day + '</b>'
      + 'год ' + s.year + '</span>'
      + '</button>';
  }).join('');

  const empty = '<p class="hint">Сейвов не нашлось. Обычно они лежат в '
    + '<code>%AppData%\\StardewValley\\Saves</code>. Если игра хранит их в другом месте — укажи папку вручную.</p>';

  return '<div class="hero">'
    + '<h1>Узелки Общественного центра</h1>'
    + '<p class="lead">помощник на первый год в долине</p>'
    + (saves.length
        ? '<p class="lead" style="margin-bottom:14px">Выбери сохранение — отмечу уже сданное и подставлю дату</p>'
          + '<div class="savelist">' + cards + '</div>'
        : empty)
    + '<div class="actions">'
    + '<button data-act="manual"' + (saves.length ? '' : ' class="on"') + '>Без сейва, вручную</button>'
    + '<button data-act="addRoot">Указать другую папку</button>'
    // на первом запуске стирать нечего — деструктивная кнопка только пугает
    + (Object.keys(S.bySave).length ? '<button data-act="resetAll" class="danger">Стереть все данные</button>' : '')
    + '</div>'
    + '<p class="hint">Я только читаю сохранения — в файлы игры не пишу ничего.</p>'
    + '</div>';
}

/* ===================== ЭКРАН 2 — МОДЫ ===================== */

async function modsHTML(): Promise<string> {
  if (bridge) {
    mods = await bridge.game.mods();
    gamePath = (await bridge.game.detect()).path;
    dropPath = await bridge.game.dropDir();
  }

  const cards = mods.map((m) => {
    const t = MOD_TEXT[m.key];
    if (!t) return '';
    // data-key, а не позиция: карточки без описания пропускаются,
    // и сопоставление по индексу разъедется при первом же новом моде
    return '<div class="modcard" data-key="' + esc(m.key) + '"><div class="mi">'
      + '<div class="mn">' + esc(m.name)
      + (m.installed
          ? '<span class="ok-chip">✓ стоит' + (m.version ? ' ' + esc(m.version) : '') + '</span>'
          : '<span class="no-chip">— нет</span>')
      + '</div>'
      + '<div class="md">' + esc(t.what) + '</div>'
      + '<div class="mw">' + esc(t.why) + '</div>'
      + '</div><button data-ext="' + esc(t.url) + '"'
      + ' aria-label="Открыть страницу мода ' + esc(m.name) + '">Открыть ↗</button></div>';
  }).join('');

  return '<div class="hero" style="max-width:820px">'
    + '<h1>Моды — по желанию</h1>'
    + '<p class="lead">Трекер работает и без них. Эти просто убирают беготню.</p>'
    + '<div class="savelist">' + cards + '</div>'
    + '<div class="panel" style="text-align:left;margin-top:18px">'
    + '<h2>Без модов: профессия Следопыт</h2>'
    + '<p class="note" style="font-style:normal">Собирательство ур. 10, ветка Gatherer. Рисует стрелки по краям '
    + 'экрана к собираемым предметам и артефактным точкам. Зашёл в локацию, стрелок нет — значит брать нечего. '
    + 'Это ваниль, ставить ничего не надо.</p></div>'
    + '<div class="panel" style="text-align:left">'
    + '<h2>Как установить</h2>'
    + '<p class="note" style="font-style:normal">'
    + (gamePath ? 'Игра найдена: <b>' + esc(gamePath) + '</b><br>' : '<b>Игра не найдена</b> — тогда проверка это покажет.<br>')
    + 'SMAPI и UI Info Suite ставятся автоматически. Остальные живут только на Nexus, '
    + 'и скачать их скриптом без логина нельзя — скрипт откроет страницы, ты скачаешь zip '
    + 'и кинешь в папку <code>drop</code>, а он разложит по <code>Mods</code>.</p>'
    + '<div class="droprow"><span class="sb-meta">Папка для скачанных архивов:</span>'
    + '<code class="droppath">' + esc(dropPath || '—') + '</code>'
    + '<button data-act="openDrop">Открыть папку</button></div>'
    + '<div class="actions" style="justify-content:flex-start;margin-top:10px">'
    + '<button data-act="bootstrapDry">Проверить без изменений</button>'
    + '<button data-act="bootstrapRun" class="on">Установить (откроется PowerShell)</button>'
    + '</div>'
    + '<p class="note" style="margin-top:8px">'
    + '<b>Проверить</b> — ничего не скачивает и не меняет: находит игру и показывает, '
    + 'что было бы сделано. Лог виден прямо здесь.<br>'
    + '<b>Установить</b> — открывает окно PowerShell и спрашивает подтверждение там. '
    + 'В окне, а не здесь, потому что установщику SMAPI нужна настоящая консоль — '
    + 'без неё он падает.</p>'
    + '<div id="bootlog" class="bootlog" hidden></div>'
    + '<div id="bootstatus" class="bootstatus" hidden></div>'
    + '</div>'
    + '<div class="actions">'
    + '<button data-act="toTracker" class="on">Дальше, к трекеру</button>'
    + '</div></div>';
}

/* ===================== ДЕЙСТВИЯ ===================== */

export async function action(name: string, el: HTMLElement): Promise<void> {
  const { render } = await import('../main');

  if (name === 'pickSave') {
    const id = el.closest<HTMLElement>('[data-id]')?.dataset.id;
    const s = saves.find((x) => x.id === id);
    if (!s) return;
    applySave(s);
    S.screen = S.modsSeen ? 'tracker' : 'mods';
    S.modsSeen = true;
    save();
    render();
    return;
  }

  if (name === 'manual') {
    S.saveId = 'manual';
    S.save = null;
    S.screen = S.modsSeen ? 'tracker' : 'mods';
    S.modsSeen = true;
    save();
    render();
    return;
  }

  if (name === 'addRoot') {
    if (!bridge) return;
    const p = await bridge.pickFolder('Папка с сохранениями Stardew Valley');
    if (!p) return;
    await bridge.saves.addRoot(p);
    render();
    return;
  }

  if (name === 'toTracker') {
    S.screen = 'tracker';
    save();
    render();
    return;
  }

  if (name === 'bootstrapDry') {
    await startBootstrap();
    return;
  }

  if (name === 'bootstrapRun') {
    // Установщик SMAPI отказывается работать без настоящей консоли:
    // «Cannot read keys when application does not have a console».
    // Поэтому реальная установка идёт в окне PowerShell, а не внутри приложения.
    if (!bridge) return;
    const status = document.getElementById('bootstatus');
    const r = await bridge.game.bootstrapInConsole();
    if (status) {
      status.hidden = false;
      status.className = 'bootstatus ' + (r.started ? 'ok' : 'bad');
      status.textContent = r.started
        ? '✓ Открылось окно установки — отвечай на вопросы в нём. Установщику SMAPI нужна настоящая консоль, внутри приложения он не работает.'
        : '✕ Не удалось открыть окно: ' + (r.error || 'неизвестная причина');
    }
    return;
  }

  if (name === 'bootstrapCancel') {
    if (bridge) await bridge.game.cancelBootstrap();
    return;
  }

  if (name === 'openDrop') {
    if (!bridge) return;
    const err = await bridge.game.openDropDir();
    if (err) alert('Не удалось открыть папку: ' + err);
    return;
  }

  if (name === 'resync') {
    if (!bridge || !S.save) return;
    const fresh = await bridge.saves.read(S.save.id);
    if (!fresh) {
      alert('Сейв больше не находится — возможно, папка изменилась.');
      return;
    }
    applySave(fresh);
    save();
    render();
    return;
  }

  if (name === 'openUrl') {
    const u = el.dataset.url;
    if (u) openExternal(u);
  }
}

/**
 * Запуск бутстрапа с живым логом. Перерисовку экрана при этом не делаем:
 * иначе панель с логом снесёт на первой же строке.
 */
async function startBootstrap(): Promise<void> {
  if (!bridge) return;
  const log = document.getElementById('bootlog');
  const status = document.getElementById('bootstatus');
  if (!log || !status) return;

  log.textContent = '';
  log.hidden = false;
  status.hidden = false;
  status.className = 'bootstatus running';
  status.innerHTML = '⏳ идёт проверка… <button data-act="bootstrapCancel">Прервать</button>';
  setButtons(true);

  bridge.game.onLine((line, isErr) => {
    const div = document.createElement('div');
    if (isErr) div.className = 'err';
    div.textContent = line;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  });

  bridge.game.onDone(async (code) => {
    setButtons(false);
    const ok = code === 0;
    status.className = 'bootstatus ' + (ok ? 'ok' : 'bad');
    status.textContent = ok
      ? '✓ Проверка прошла. Ничего не изменилось.'
      : '✕ Завершилось с кодом ' + code + '. Смотри лог выше.';
    // перечитываем папку Mods: вдруг что-то поставилось в окне PowerShell
    if (bridge) {
      mods = await bridge.game.mods();
      refreshModChips();
    }
  });

  const r = await bridge.game.runBootstrap({ mode: 'dry' });
  if (!r.started) {
    setButtons(false);
    status.className = 'bootstatus bad';
    status.textContent = '✕ Не удалось запустить: ' + (r.error || 'неизвестная причина');
  }
}

function setButtons(busy: boolean): void {
  for (const act of ['bootstrapDry', 'bootstrapRun', 'bootstrapConsole']) {
    const b = document.querySelector<HTMLButtonElement>('[data-act="' + act + '"]');
    if (b) b.disabled = busy;
  }
}

/** Обновляем отметки «стоит / нет» без перерисовки всего экрана. */
function refreshModChips(): void {
  document.querySelectorAll<HTMLElement>('.modcard').forEach((card) => {
    const m = mods.find((x) => x.key === card.dataset.key);
    if (!m) return;
    const chip = card.querySelector('.ok-chip, .no-chip');
    if (!chip) return;
    chip.className = m.installed ? 'ok-chip' : 'no-chip';
    chip.textContent = m.installed ? '✓ стоит' + (m.version ? ' ' + m.version : '') : '— нет';
  });
}

/**
 * Переносим прогресс из сейва в отметки трекера.
 * Ручные галочки сейва не перетирают: объединяем, а не заменяем.
 */
function applySave(s: SaveSummary): void {
  S.saveId = s.id;
  S.save = s;
  S.season = s.season;
  S.day = s.day;

  if (!s.bundlesSupported) return;

  const p = progress();
  for (const r of ROOMS) {
    for (const b of r.bundles) {
      if (b.items) {
        const idx = s.progress[b.id];
        if (!idx) continue;
        for (const i of idx) p.checked[b.id + ':' + i] = 1;
      } else if (s.vault[b.id]) {
        p.checked[b.id] = 1;
      }
    }
  }
}

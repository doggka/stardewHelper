import type { Bundle, Item, Room, SaveSummary, Season, Weather } from './types';
import { ROOMS } from './data/bundles';

export type Screen = 'welcome' | 'mods' | 'tracker';

/** Прогресс отдельного сейва. Ключ — uniqueIDForThisGame, либо 'manual'. */
export interface Progress {
  checked: Record<string, 1>;
}

export interface AppState {
  screen: Screen;
  /** какой сейв выбран; 'manual' — ручной режим без сейва */
  saveId: string;
  /** сводка выбранного сейва, если он есть */
  save: SaveSummary | null;
  /** показывали ли уже экран модов */
  modsSeen: boolean;
  /** чем запускать игру: 'smapi' | 'direct' | 'steam' */
  launchMode: string;

  season: Season;
  day: number;
  weather: Weather;
  tab: string;
  q: string;
  y1guarantee: boolean;
  hideDone: boolean;
  locFilter: string | null;
  /** id предметов с раскрытым «где добывать» — в состоянии, а не классом на узле,
   *  иначе подсказка схлопывается при любой перерисовке */
  openSrc: string[];
  /** закрытые узелки, которые пользователь развернул вручную */
  openBundles: string[];
  /** раскрытые строки блока «Сегодня»: 'last' | 'now' */
  todayOpen: string[];
  /** закрытые комнаты, которые пользователь развернул вручную */
  openRooms: string[];

  /** прогресс по каждому сейву отдельно */
  bySave: Record<string, Progress>;
}

const KEY = 'sdv-helper-v3';
const V2_KEY = 'sdv-helper-v2';
const OLD_KEY = 'sdv-bundles-v1';

/**
 * При переносе с v2 не тащим фильтры. Раньше их ставили кнопки блока
 * «Сегодня», потом кнопки убрали — а сохранённое значение осталось
 * и продолжало прореживать комнаты: комната, где под фильтр не попал
 * ни один узелок, пропускается целиком.
 */
const DROP_ON_UPGRADE = ['filters', 'locFilter', 'hideDone'];

function defaults(): AppState {
  return {
    screen: 'welcome', saveId: 'manual', save: null, modsSeen: false, launchMode: 'smapi',
    season: 0, day: 1, weather: 'sun', tab: 'rooms', q: '',
    y1guarantee: false, hideDone: false, locFilter: null,
    openSrc: [], openBundles: [], todayOpen: [], openRooms: [],
    bySave: {},
  };
}

const SCREENS = ['welcome', 'mods', 'tracker'];
// rooms и day — вкладки в шапке; plan и cart — справочники из меню «⋯»
const TABS = ['rooms', 'day', 'plan', 'cart'];
const TODAY_ROWS = ['last', 'crops', 'fish', 'now', 'fair'];

/**
 * Приводит состояние в рабочий вид. Нужен и при загрузке, и при импорте файла:
 * JSON.parse пропускает любой синтаксически верный мусор, а Object.assign
 * радостно кладёт строку туда, где ожидается номер сезона.
 */
export function sanitize(s: AppState): void {
  if (typeof s.season !== 'number' || s.season < 0 || s.season > 3) s.season = 0;
  s.season = Math.floor(s.season) as 0 | 1 | 2 | 3;
  if (typeof s.day !== 'number' || s.day < 1 || s.day > 28) s.day = 1;
  s.day = Math.floor(s.day);
  if (s.weather !== 'sun' && s.weather !== 'rain') s.weather = 'sun';
  if (SCREENS.indexOf(s.screen) < 0) s.screen = 'tracker';
  if (TABS.indexOf(s.tab) < 0) s.tab = 'rooms';
  if (typeof s.q !== 'string') s.q = '';
  // фильтра по статусу больше нет; у старых состояний поле просто удаляем,
  // иначе оно так и будет ездить в localStorage
  delete (s as unknown as Record<string, unknown>).filters;
  if (!Array.isArray(s.openSrc)) s.openSrc = [];
  if (!Array.isArray(s.openBundles)) s.openBundles = [];
  if (!Array.isArray(s.todayOpen)) s.todayOpen = [];
  if (!Array.isArray(s.openRooms)) s.openRooms = [];
  s.todayOpen = s.todayOpen.filter((k) => TODAY_ROWS.indexOf(k) >= 0);
  if (typeof s.locFilter !== 'string') s.locFilter = null;
  s.hideDone = !!s.hideDone;
  s.y1guarantee = !!s.y1guarantee;
  s.modsSeen = !!s.modsSeen;
  if (!s.bySave || typeof s.bySave !== 'object') s.bySave = {};
  for (const k of Object.keys(s.bySave)) {
    const p = s.bySave[k];
    if (!p || typeof p !== 'object' || !p.checked || typeof p.checked !== 'object') {
      s.bySave[k] = { checked: {} };
    }
  }
  if (['smapi', 'direct', 'steam'].indexOf(s.launchMode) < 0) s.launchMode = 'smapi';
  if (typeof s.saveId !== 'string' || !s.saveId) s.saveId = 'manual';
  if (s.save && typeof s.save !== 'object') s.save = null;
}

export const S: AppState = defaults();

/** Прогресс текущего сейва. Создаётся лениво. */
export function progress(): Progress {
  let p = S.bySave[S.saveId];
  if (!p) {
    p = { checked: {} };
    S.bySave[S.saveId] = p;
  }
  return p;
}

export function load(): void {
  try {
    const raw = localStorage.getItem(KEY);
    const v2 = raw ? null : localStorage.getItem(V2_KEY);
    if (raw) {
      Object.assign(S, JSON.parse(raw));
    } else if (v2) {
      // галочки по сейвам переносим полностью, фильтры — нет
      const o = JSON.parse(v2) as Record<string, unknown>;
      DROP_ON_UPGRADE.forEach((k) => delete o[k]);
      Object.assign(S, o);
    } else {
      // Миграция со старой браузерной версии: её единственный прогресс
      // становится ручным режимом, чтобы ничего не потерялось.
      const old = localStorage.getItem(OLD_KEY);
      if (old) {
        const o = JSON.parse(old);
        S.bySave['manual'] = { checked: o.checked || {} };
        if (typeof o.season === 'number') S.season = o.season;
        if (typeof o.day === 'number') S.day = o.day;
        if (o.weather) S.weather = o.weather;
        if (o.y1guarantee) S.y1guarantee = true;
      }
    }
  } catch {
    /* повреждённое состояние просто игнорируем — лучше чистый старт, чем падение */
  }
  sanitize(S);
}

export function save(): void {
  localStorage.setItem(KEY, JSON.stringify(S));
}

/* ---- производные структуры по данным узелков ---- */

export const ALL: Item[] = [];

ROOMS.forEach((r: Room) =>
  r.bundles.forEach((b: Bundle) => {
    b.room = r;
    (b.items || []).forEach((it, i) => {
      it.id = b.id + ':' + i;
      it.bundle = b;
      ALL.push(it);
    });
  }),
);

ALL.forEach((it) => {
  it.earliest = it.e !== undefined ? it.e : it.s ? (Math.min.apply(null, it.s as number[]) as Season) : 0;
});

ROOMS.forEach((r: Room) =>
  r.bundles.forEach((b: Bundle) => {
    if (!b.items) {
      b.earliest = 1;
      return;
    }
    const e = b.items.map((i) => i.earliest).sort((a, c) => a - c);
    b.earliest = e[b.slots - 1];
  }),
);

export { ROOMS };
